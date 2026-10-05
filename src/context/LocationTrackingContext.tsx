import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as Notifications from 'expo-notifications';

import type { Coordinates } from '../models/Journey';
import { haversineMeters } from '../models/Place';
import type { TrackingMotion } from '../providers/LocationProvider';
import { ARRIVAL_GEOFENCE_RADIUS_METERS } from '../models/TrackingConfig';
import { DEFAULT_ARRIVAL_RADIUS_METERS } from '../models/Place';

/**
 * How long the traveller must stay inside the arrival radius before it counts.
 *
 * Option 15 §D sets this at 20 s, tightening the journey-flow spec's 30 s.
 * Short enough that arriving feels immediate, long enough that walking past
 * the end of the street doesn't end the journey and tell guardians someone
 * arrived when they hadn't.
 */
const ARRIVAL_DWELL_MS = 20_000;
import type { LocationTrackingService } from '../services/LocationTrackingService';
import { useAuthContext } from './AuthContext';
import { useJourneyContext } from './JourneyContext';
import { useBatteryContext } from './BatteryContext';

interface LocationTrackingContextValue {
  currentLocation: Coordinates | null;
  /** When currentLocation was last set — drives the live/weak/lost connectivity indicator. */
  lastLocationUpdateAt: Date | null;
  isTracking: boolean;
  /** True once the arrival geofence has fired for the current journey. Manual "End Journey" always remains available regardless — this is a suggestion, never automatic. */
  arrivalDetected: boolean;
  /** Dismisses the arrival banner without ending the journey (e.g. false positive, still moving). */
  dismissArrival(): void;
  /** True if background ("Always") location was revoked mid-journey after having been engaged — tracking continues in foreground-only mode, but contacts won't see updates while the app isn't open. */
  backgroundPermissionRevoked: boolean;
  /** Dismisses the downgrade warning banner. */
  dismissPermissionWarning(): void;
  /** Set to true when SOS is active to keep tracking running at high accuracy. */
  setSosTracking(active: boolean): void;
  /**
   * A single position fix, for screens that need an origin *before* a journey
   * exists — the route preview on 04, distance ranking on 02, the map picker's
   * starting camera.
   *
   * Exposed here rather than letting hooks reach the location singleton
   * directly: this context already owns location, and a hook importing a
   * provider from the composition root bypasses the port layer entirely.
   *
   * Rejects when permission is missing. Callers treat that as "skip the
   * distance line", never as an error to show — screen 05 is where permission
   * is actually asked for.
   */
  getCurrentPosition(): Promise<Coordinates>;
}

export const LocationTrackingContext = createContext<LocationTrackingContextValue>({
  currentLocation: null,
  lastLocationUpdateAt: null,
  isTracking: false,
  arrivalDetected: false,
  dismissArrival: () => {},
  backgroundPermissionRevoked: false,
  dismissPermissionWarning: () => {},
  setSosTracking: () => {},
  getCurrentPosition: () => Promise.reject(new Error('LocationTrackingContext not mounted.')),
});

export function LocationTrackingProvider({
  trackingService,
  children,
}: {
  trackingService: LocationTrackingService;
  children: React.ReactNode;
}) {
  const { user } = useAuthContext();
  const { activeJourney } = useJourneyContext();
  const { batteryLevel } = useBatteryContext();

  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [lastLocationUpdateAt, setLastLocationUpdateAt] = useState<Date | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [sosUserId, setSosUserId] = useState<string | null>(null);
  const [arrivalDetected, setArrivalDetected] = useState(false);
  const [backgroundPermissionRevoked, setBackgroundPermissionRevoked] = useState(false);

  // When the traveller first came inside the arrival radius; null while
  // outside it. Drives the dwell requirement below.
  const insideSinceRef = useRef<number | null>(null);

  const batteryLevelRef = useRef(batteryLevel);

  // Keep the service's battery level in sync without triggering a re-render loop.
  useEffect(() => {
    if (batteryLevel !== batteryLevelRef.current) {
      batteryLevelRef.current = batteryLevel;
      trackingService.updateBatteryLevel(batteryLevel);
    }
  }, [batteryLevel, trackingService]);

  const journeyId =
    activeJourney?.status === 'ACTIVE' ? activeJourney.id : null;

  /**
   * The journey's travel mode, as a motion profile the OS can tune against.
   * Walking and cycling are pedestrian-ish duty cycles; bus and car are not.
   */
  const motion: TrackingMotion =
    activeJourney === null
      ? 'unknown'
      : activeJourney.travelMode === 'walk' || activeJourney.travelMode === 'bike'
        ? 'pedestrian'
        : 'vehicle';

  // Wire the service's downgrade callback once. New journey/session → reset the warning.
  useEffect(() => {
    setBackgroundPermissionRevoked(false);
    trackingService.onBackgroundPermissionRevoked = () => {
      setBackgroundPermissionRevoked(true);
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Background location turned off',
          body: "wayLoc can no longer track your journey while the app is closed. Reopen wayLoc to keep your contacts updated, or re-enable \"Always\" location access in Settings.",
          sound: true,
        },
        trigger: null,
      }).catch(() => {});
    };
    return () => {
      trackingService.onBackgroundPermissionRevoked = null;
    };
  }, [journeyId, trackingService]);

  // SOS tracking control — exposed to SOSContext which is a child provider.
  const setSosTracking = useCallback(
    (active: boolean) => {
      trackingService.setSOSActive(active);
      setSosUserId(active ? (user?.id ?? null) : null);
    },
    [trackingService, user?.id],
  );

  useEffect(() => {
    const userId = user?.id ?? null;

    // Track when there is an active journey OR when SOS is active (no journey needed).
    // journeyId is null during SOS-only mode — the service writes to UI only, no Firestore.
    const shouldTrack = userId !== null && (journeyId !== null || sosUserId !== null);

    if (!shouldTrack) {
      if (trackingService.isTracking()) {
        void trackingService.stopTracking();
        setIsTracking(false);
        setCurrentLocation(null);
        setLastLocationUpdateAt(null);
      }
      return;
    }

    let cancelled = false;

    trackingService
      .startTracking(
        userId,
        journeyId,
        (coords) => {
          if (!cancelled) {
            setCurrentLocation(coords);
            setLastLocationUpdateAt(new Date());
          }
        },
        motion,
      )
      .then(() => {
        if (!cancelled) setIsTracking(true);
      })
      .catch(() => {
        if (!cancelled) setIsTracking(false);
      });

    return () => {
      cancelled = true;
      void trackingService.stopTracking();
      setIsTracking(false);
      setCurrentLocation(null);
      setLastLocationUpdateAt(null);
    };
  // trackingService is a singleton.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, journeyId, sosUserId, motion, trackingService]);

  const destination = activeJourney?.destinationCoordinates ?? null;
  const destinationLabel = activeJourney?.destination?.name ?? activeJourney?.destinationLabel ?? null;

  /**
   * The journey's own arrival radius (JOURNEY_FLOW_SPEC §3: default 100 m,
   * adjustable per saved place on screen 03), floored at the OS geofence
   * minimum. ARRIVAL_GEOFENCE_RADIUS_METERS (150 m) is that floor: consumer
   * GPS error alone is routinely 10–50 m and worse beside tall buildings, so
   * a 50 m geofence would simply never fire reliably. The tighter user-chosen
   * radius is still honoured — the dwell check below re-tests it against the
   * actual position before arrival is declared.
   */
  const configuredRadius = activeJourney?.arrivalRadiusMeters ?? DEFAULT_ARRIVAL_RADIUS_METERS;
  const geofenceRadius = Math.max(configuredRadius, ARRIVAL_GEOFENCE_RADIUS_METERS);

  // Arrival geofence — independent of the tracking effect above. OS-level
  // monitoring (see ExpoLocationProvider), so this keeps working even if the
  // continuous-tracking JS callback stalls. A no-op when the journey has no
  // destination coordinates (routing wasn't used) — manual "End Journey"
  // remains the only path in that case, same as today.
  useEffect(() => {
    setArrivalDetected(false);

    if (!journeyId || !destination) {
      void trackingService.stopGeofencing();
      return;
    }

    let cancelled = false;

    void trackingService.startGeofencing(destination, geofenceRadius, () => {
      if (cancelled) return;
      setArrivalDetected(true);
      // Backstop for the backgrounded case — the geofence task fires even if
      // the app was backgrounded, but nothing guarantees the JS/React state
      // update above translates into anything the user sees if the screen
      // isn't currently open. A local notification does not depend on that.
      Notifications.scheduleNotificationAsync({
        content: {
          title: "You've arrived",
          body: destinationLabel
            ? `Looks like you've reached ${destinationLabel}. Open wayLoc to confirm you're safe.`
            : "Open wayLoc to confirm you're safe.",
          sound: true,
        },
        trigger: null,
      }).catch(() => {});
    });

    return () => {
      cancelled = true;
      void trackingService.stopGeofencing();
    };
  // trackingService is a singleton.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyId, destination?.latitude, destination?.longitude, destinationLabel, geofenceRadius]);

  /**
   * Foreground confirmation of arrival, per the spec's "within the place's
   * arrival radius (default 100 m) for 30 s".
   *
   * The OS geofence above is the backstop that works with the app closed, but
   * it can only be armed at the wider radius the platform will reliably fire
   * at. This re-tests the user's actual chosen radius against live positions,
   * and requires the traveller to *stay* inside it — otherwise walking past
   * the end of the street would end the journey early and tell the guardians
   * someone had arrived when they hadn't.
   */
  useEffect(() => {
    if (!journeyId || !destination || !currentLocation || arrivalDetected) {
      insideSinceRef.current = null;
      return;
    }

    const distance = haversineMeters(currentLocation, destination);

    if (distance > configuredRadius) {
      insideSinceRef.current = null;
      return;
    }

    if (insideSinceRef.current === null) {
      insideSinceRef.current = Date.now();
    }

    const elapsed = Date.now() - insideSinceRef.current;
    if (elapsed >= ARRIVAL_DWELL_MS) {
      setArrivalDetected(true);
      return;
    }

    // Finish the dwell on a timer rather than waiting for the next fix.
    // Standing still is exactly when tracking backs off its update rate, so
    // keying arrival purely to the next position report would make the app
    // slowest to notice arrival in the most ordinary case of it.
    const remaining = ARRIVAL_DWELL_MS - elapsed;
    const timer = setTimeout(() => {
      // Re-checked because the position may have moved on in the meantime and
      // this closure would otherwise assert an arrival that is no longer true.
      if (insideSinceRef.current !== null && Date.now() - insideSinceRef.current >= ARRIVAL_DWELL_MS) {
        setArrivalDetected(true);
      }
    }, remaining);

    return () => clearTimeout(timer);
  }, [journeyId, currentLocation, destination, configuredRadius, arrivalDetected]);

  const getCurrentPosition = useCallback(
    () => trackingService.getCurrentLocation(),
    [trackingService],
  );

  const dismissArrival = useCallback(() => {
    setArrivalDetected(false);
  }, []);

  const dismissPermissionWarning = useCallback(() => {
    setBackgroundPermissionRevoked(false);
  }, []);

  const value = useMemo<LocationTrackingContextValue>(
    () => ({
      currentLocation,
      lastLocationUpdateAt,
      isTracking,
      arrivalDetected,
      dismissArrival,
      backgroundPermissionRevoked,
      dismissPermissionWarning,
      setSosTracking,
      getCurrentPosition,
    }),
    [
      currentLocation,
      lastLocationUpdateAt,
      isTracking,
      arrivalDetected,
      dismissArrival,
      backgroundPermissionRevoked,
      dismissPermissionWarning,
      setSosTracking,
      getCurrentPosition,
    ],
  );

  return (
    <LocationTrackingContext.Provider value={value}>
      {children}
    </LocationTrackingContext.Provider>
  );
}

export function useLocationTrackingContext(): LocationTrackingContextValue {
  return useContext(LocationTrackingContext);
}
