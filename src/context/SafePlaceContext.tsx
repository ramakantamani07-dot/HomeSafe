import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { Coordinates } from '../models/Journey';
import type { SafePlace } from '../models/SafePlace';
import type { SafePlaceProvider } from '../providers/SafePlaceProvider';

interface SafePlaceContextValue {
  places: SafePlace[];
  isSearching: boolean;
  /** True once a search has finished and found nothing — distinct from "not asked yet". */
  isEmpty: boolean;
  find(near: Coordinates): Promise<void>;
}

const SafePlaceContext = createContext<SafePlaceContextValue>({
  places: [],
  isSearching: false,
  isEmpty: false,
  find: async () => {},
});

/**
 * Nearby places to head for when uneasy (`AI5`).
 *
 * Its own context rather than another field on JourneyContext: this works with
 * or without a journey, and its dependency is location, not the journey record.
 * Small, but the project keeps one context per concern and folding it in would
 * be the start of JourneyContext becoming the place everything goes.
 */
export function SafePlaceStateProvider({
  safePlaceProvider,
  children,
}: {
  safePlaceProvider: SafePlaceProvider;
  children: React.ReactNode;
}) {
  const [places, setPlaces] = useState<SafePlace[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const find = useCallback(
    async (near: Coordinates) => {
      setIsSearching(true);
      try {
        setPlaces(await safePlaceProvider.findNearby(near));
      } catch {
        // Someone who already feels uneasy should not be handed an error
        // dialog. An empty list renders the screen's "nothing nearby" state,
        // and the other ways to get help are still right there.
        setPlaces([]);
      } finally {
        setHasSearched(true);
        setIsSearching(false);
      }
    },
    [safePlaceProvider],
  );

  const value = useMemo(
    () => ({ places, isSearching, isEmpty: hasSearched && places.length === 0, find }),
    [places, isSearching, hasSearched, find],
  );

  return <SafePlaceContext.Provider value={value}>{children}</SafePlaceContext.Provider>;
}

export function useSafePlaceContext(): SafePlaceContextValue {
  return useContext(SafePlaceContext);
}
