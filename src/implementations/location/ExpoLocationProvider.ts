import * as Location from 'expo-location';

import type {
  ArrivalHandler,
  LocationProvider,
  LocationTrackingOptions,
  LocationUpdateHandler,
  TrackingMotion,
} from '../../providers/LocationProvider';
import type { Coordinates } from '../../models/Journey';
import type { LocationUpdate } from '../../models/LocationUpdate';

/**
 * Maps our platform-free motion hint onto iOS's CLActivityType. Android
 * ignores it, which is why the port speaks in motion rather than in Apple's
 * vocabulary.
 */
function toActivityType(motion: TrackingMotion | undefined): Location.LocationActivityType {
  switch (motion) {
    case 'pedestrian':
      return Location.LocationActivityType.Fitness;
    case 'vehicle':
      return Location.LocationActivityType.AutomotiveNavigation;
    default:
      return Location.LocationActivityType.Other;
  }
}

const BACKGROUND_TASK_NAME = 'wayloc.location-tracking';
const GEOFENCE_TASK_NAME = 'wayloc.geofence-arrival';
const GEOFENCE_REGION_ID = 'destination';

// Module-level handler references written by startTracking/startGeofencing so
// the TaskManager task callbacks (which cannot close over `this`) can forward
// events back into the class instance that's currently active.
let _bgHandler: LocationUpdateHandler | null = null;
let _arrivalHandler: ArrivalHandler | null = null;

// Attempt to define both background tasks once at module load. Requires
// expo-task-manager which is an optional native module. If it isn't installed
// both defineTask calls throw and we fall back to foreground-only tracking /
// no geofencing — both are treated as best-effort, not required capabilities.
let _taskManagerAvailable = false;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const TaskManager = require('expo-task-manager') as {
    defineTask(
      name: string,
      executor: (params: { data: unknown; error: { message: string } | null }) => void,
    ): void;
  };

  TaskManager.defineTask(BACKGROUND_TASK_NAME, ({ data, error }) => {
    const locations = (data as { locations?: Location.LocationObject[] } | null)?.locations;
    if (error || !locations || !_bgHandler) return;
    for (const loc of locations) {
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

  TaskManager.defineTask(GEOFENCE_TASK_NAME, ({ data, error }) => {
    const geofenceData = data as { eventType?: Location.GeofencingEventType } | null;
    if (error || !geofenceData || !_arrivalHandler) return;
    if (geofenceData.eventType === Location.GeofencingEventType.Enter) {
      _arrivalHandler();
    }
  });

  _taskManagerAvailable = true;
} catch {
  _taskManagerAvailable = false;
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
    if (options.enableBackground && _taskManagerAvailable) {
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
            // Lets iOS tune the GPS duty cycle to the expected motion instead
            // of assuming the worst case. Free battery, no loss of fidelity.
            activityType: toActivityType(options.motion),
            // Deliberately false, and it must stay false.
            //
            // When true, iOS powers down location hardware once it decides the
            // device is stationary. That is normally a large battery win — but
            // this app's whole "stopped for 10 minutes" check depends on
            // samples continuing to arrive while the traveller is *not*
            // moving. Letting the OS pause them would silently starve the
            // detector exactly when it matters, and the feed would look dead
            // rather than stationary (see STALE_FEED_MS in SafetyCheckService,
            // which would then correctly refuse to raise a check at all).
            //
            // A deliberate battery cost bought for a correctness guarantee.
            pausesUpdatesAutomatically: false,
            foregroundService: {
              notificationTitle: 'wayLoc is tracking your journey',
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

  isUsingBackgroundMode(): boolean {
    return this.usingBackground;
  }

  async hasBackgroundPermission(): Promise<boolean> {
    const { granted } = await Location.getBackgroundPermissionsAsync().catch(() => ({
      granted: false,
    }));
    return granted;
  }

  async startGeofencing(
    destination: Coordinates,
    radiusMeters: number,
    onArrival: ArrivalHandler,
  ): Promise<void> {
    if (!_taskManagerAvailable) return;

    _arrivalHandler = onArrival;
    await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, [
      {
        identifier: GEOFENCE_REGION_ID,
        latitude: destination.latitude,
        longitude: destination.longitude,
        radius: radiusMeters,
        notifyOnEnter: true,
        notifyOnExit: false,
      },
    ]).catch(() => {
      // Best-effort — arrival detection is a bonus on top of manual "End
      // Journey", not something the rest of the app depends on.
    });
  }

  async stopGeofencing(): Promise<void> {
    _arrivalHandler = null;
    if (!_taskManagerAvailable) return;

    const running = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME).catch(
      () => false,
    );
    if (running) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME).catch(() => {});
    }
  }

  private async ensureBackgroundPermission(): Promise<boolean> {
    const current = await Location.getBackgroundPermissionsAsync().catch(() => ({
      granted: false,
      canAskAgain: false,
    }));
    if (current.granted) return true;
    // Previously this only ever checked status — it never actually prompted,
    // so a fresh install could never get background tracking to engage at
    // all, regardless of app.config.ts's UIBackgroundModes/manifest setup.
    // Requesting here (at journey start, when the feature is actually being
    // used) matches Apple's just-in-time permission guidance, and iOS
    // requires foreground permission to already be granted before this
    // upgrades it to "Always" — startTracking already checks that first.
    if (!current.canAskAgain) return false;
    const requested = await Location.requestBackgroundPermissionsAsync().catch(() => ({
      granted: false,
    }));
    return requested.granted;
  }
}
