import { useCallback, useEffect, useRef, useState } from 'react';

import type { Coordinates } from '../models/Journey';
import type { PlaceSuggestion } from '../models/Place';
import { SEARCH_DEBOUNCE_MS } from '../services/PlacesService';
import { usePlaces } from './usePlaces';

interface PlaceSearchState {
  query: string;
  setQuery(next: string): void;
  results: PlaceSuggestion[];
  isSearching: boolean;
  error: string | null;
  /** True once a search has run and come back with nothing. */
  isEmpty: boolean;
  clear(): void;
}

/**
 * Debounced address search for screen 02.
 *
 * Owns the spec's ~300 ms debounce and 3-character minimum so the screen is
 * pure presentation, and so a keystroke arriving mid-request can never leave
 * stale results on screen (PlacesService discards superseded responses).
 */
export function usePlaceSearch(near: Coordinates | null): PlaceSearchState {
  const { placesService } = usePlaces();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Primitive deps — passing the coordinates object straight into the effect
  // would re-run the search on every GPS tick.
  const nearLat = near?.latitude ?? null;
  const nearLng = near?.longitude ?? null;

  useEffect(() => {
    if (!placesService.shouldSearch(query)) {
      placesService.cancelPendingSearch();
      setResults([]);
      setIsSearching(false);
      setError(null);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setError(null);

    const timer = setTimeout(() => {
      const anchor = nearLat !== null && nearLng !== null
        ? { latitude: nearLat, longitude: nearLng }
        : null;

      placesService
        .search(query, anchor)
        .then((found) => {
          setResults(found);
          setHasSearched(true);
          setIsSearching(false);
        })
        .catch((err: unknown) => {
          // A superseded request isn't a failure — the newer one owns the UI.
          if ((err as Error)?.name === 'AbortError') return;
          setError("We couldn't search for addresses just now. Check your connection and try again.");
          setIsSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, nearLat, nearLng, placesService]);

  // Cancel anything in flight when the screen unmounts.
  const serviceRef = useRef(placesService);
  serviceRef.current = placesService;
  useEffect(() => () => serviceRef.current.cancelPendingSearch(), []);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
    setHasSearched(false);
  }, []);

  return {
    query,
    setQuery,
    results,
    isSearching,
    error,
    isEmpty: hasSearched && !isSearching && results.length === 0,
    clear,
  };
}
