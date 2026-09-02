import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { Coordinates } from '../models/Journey';
import type { LocationTrackingService } from '../services/LocationTrackingService';
import { useAuthContext } from './AuthContext';
import { useJourneyContext } from './JourneyContext';
import { useBatteryContext } from './BatteryContext';

interface LocationTrackingContextValue {
  currentLocation: Coordinates | null;
  isTracking: boolean;
  /** Set to true when SOS is active to keep tracking running at high accuracy. */
  setSosTracking(active: boolean): void;
}

export const LocationTrackingContext = createContext<LocationTrackingContextValue>({
  currentLocation: null,
  isTracking: false,
  setSosTracking: () => {},
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
  const [isTracking, setIsTracking] = useState(false);
  const [sosUserId, setSosUserId] = useState<string | null>(null);

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
      }
      return;
    }

    let cancelled = false;

    trackingService
      .startTracking(userId, journeyId, (coords) => {
        if (!cancelled) setCurrentLocation(coords);
      })
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
    };
  // trackingService is a singleton.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, journeyId, sosUserId, trackingService]);

  return (
    <LocationTrackingContext.Provider
      value={{ currentLocation, isTracking, setSosTracking }}
    >
      {children}
    </LocationTrackingContext.Provider>
  );
}

export function useLocationTrackingContext(): LocationTrackingContextValue {
  return useContext(LocationTrackingContext);
}
