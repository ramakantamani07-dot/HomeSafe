import { useEffect, useState } from 'react';

import type { Coordinates } from '../models/Journey';
import { useActiveJourneyLocation } from './useActiveJourneyLocation';

interface CurrentPosition {
  position: Coordinates | null;
  isLoading: boolean;
  /** True when the one-shot fix failed — usually because location is denied. */
  unavailable: boolean;
  refresh(): void;
}

/**
 * A one-shot "where am I now" fix, for screens that need an origin *before* a
 * journey exists (route preview on 04, distance ranking on 02, the map
 * picker's starting camera).
 *
 * Prefers the live tracked position when a journey is already running, so the
 * two never disagree on screen. Fails soft: a denied permission leaves
 * `position` null and `unavailable` true, which every caller treats as "skip
 * the distance/route line", never as a blocking error — screen 05 is where
 * permission is actually asked for.
 *
 * Goes through LocationTrackingContext rather than the location singleton, so
 * the port layer stays the only route to the device's GPS.
 */
export function useCurrentPosition(): CurrentPosition {
  const { currentLocation, getCurrentPosition } = useActiveJourneyLocation();
  const [position, setPosition] = useState<Coordinates | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (currentLocation) {
      setPosition(currentLocation);
      setIsLoading(false);
      setUnavailable(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getCurrentPosition()
      .then((coords) => {
        if (cancelled) return;
        setPosition(coords);
        setUnavailable(false);
      })
      .catch(() => {
        if (cancelled) return;
        setUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [currentLocation, nonce, getCurrentPosition]);

  return {
    position: currentLocation ?? position,
    isLoading,
    unavailable,
    refresh: () => setNonce((n) => n + 1),
  };
}
