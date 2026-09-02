import * as Location from 'expo-location';

import type {
  LocationProvider,
  LocationTrackingOptions,
  LocationUpdateHandler,
} from '../../providers/LocationProvider';
import type { Coordinates } from '../../models/Journey';
import type { LocationUpdate } from '../../models/LocationUpdate';

const BACKGROUND_TASK_NAME = 'homesafe.location-tracking';

// Module-level handler reference written by startTracking so the background
// task callback (which cannot close over `this`) can forward updates.
let _bgHandler: LocationUpdateHandler | null = null;

// Attempt to define the background task once at module load. Requires
// expo-task-manager which is an optional native module. If it isn't installed
// the defineTask call throws and we fall back to foreground-only tracking.
let _backgroundTaskDefined = false;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const TaskManager = require('expo-task-manager') as {
    defineTask(
      name: string,
      executor: (params: {
        data: { locations: Location.LocationObject[] };
        error: { message: string } | null;
      }) => void,
    ): void;
  };

  TaskManager.defineTask(BACKGROUND_TASK_NAME, ({ data, error }) => {
    if (error || !data?.locations || !_bgHandler) return;
    for (const loc of data.locations) {
      _bgHandler({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        heading: loc.coords.heading,
        speed: loc.coords.speed,
        timestamp: new Date(loc.timestamp),
      });
    }
  });

  _backgroundTaskDefined = true;
} catch {
  _backgroundTaskDefined = false;
}

function toExpoAccuracy(tier?: 'high' | 'balanced' | 'low'): Location.Accuracy {
  switch (tier) {
    case 'high': return Location.Accuracy.High;
    case 'low': return Location.Accuracy.Low;
    default: return Location.Accuracy.Balanced;
  }
}

export class ExpoLocationProvider implements LocationProvider {
  private foregroundSubscription: Location.LocationSubscription | null = null;
  private usingBackground = false;

  async getCurrentLocation(): Promise<Coordinates> {
    const { granted } = await Location.getForegroundPermissionsAsync();
    if (!granted) {
      throw new Error(
        'Location permission is not granted. Enable it in Privacy & Security settings.',
      );
    }
    const result = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: result.coords.latitude,
      longitude: result.coords.longitude,
    };
  }

  async startTracking(
    options: LocationTrackingOptions,
    onUpdate: LocationUpdateHandler,
  ): Promise<void> {
    await this.stopTracking();

    const { granted } = await Location.getForegroundPermissionsAsync();
    if (!granted) {
      throw new Error(
        'Location permission is not granted. Enable it in Privacy & Security settings.',
      );
    }

    // Attempt background task registration when requested and available.
    if (options.enableBackground && _backgroundTaskDefined) {
      const bgGranted = await this.ensureBackgroundPermission();
      if (bgGranted) {
        const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(
          BACKGROUND_TASK_NAME,
        ).catch(() => false);

        if (!alreadyStarted) {
          await Location.startLocationUpdatesAsync(BACKGROUND_TASK_NAME, {
            accuracy: toExpoAccuracy(options.accuracy),
            timeInterval: options.timeInterval,
            distanceInterval: options.distanceInterval,
            showsBackgroundLocationIndicator: true,
            foregroundService: {
              notificationTitle: 'HomeSafe is tracking your journey',
              notificationBody: 'Your location is being monitored for your safety.',
            },
          }).catch(() => {
            // Background registration failed — fall through to foreground.
          });
        }

        if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK_NAME).catch(() => false)) {
          _bgHandler = onUpdate;
          this.usingBackground = true;
          return;
        }
      }
    }

    // Foreground tracking (also serves as fallback when background isn't available).
    _bgHandler = null;
    this.usingBackground = false;

    this.foregroundSubscription = await Location.watchPositionAsync(
      {
        accuracy: toExpoAccuracy(options.accuracy),
        timeInterval: options.timeInterval,
        distanceInterval: options.distanceInterval,
        mayShowUserSettingsDialog: false,
      },
      (result) => {
        const update: LocationUpdate = {
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          accuracy: result.coords.accuracy,
          heading: result.coords.heading,
          speed: result.coords.speed,
          timestamp: new Date(result.timestamp),
        };
        onUpdate(update);
      },
    );
  }

  async stopTracking(): Promise<void> {
    _bgHandler = null;

    if (this.usingBackground) {
      this.usingBackground = false;
      const running = await Location.hasStartedLocationUpdatesAsync(
        BACKGROUND_TASK_NAME,
      ).catch(() => false);
      if (running) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_TASK_NAME).catch(() => {});
      }
    }

    this.foregroundSubscription?.remove();
    this.foregroundSubscription = null;
  }

  isTracking(): boolean {
    return this.usingBackground || this.foregroundSubscription !== null;
  }

  private async ensureBackgroundPermission(): Promise<boolean> {
    const { granted } = await Location.getBackgroundPermissionsAsync().catch(() => ({
      granted: false,
    }));
    return granted;
  }
}
