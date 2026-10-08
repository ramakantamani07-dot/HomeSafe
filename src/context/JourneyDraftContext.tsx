import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { Coordinates } from '../models/Journey';
import type { Place, PlaceSuggestion, TravelMode } from '../models/Place';
import { DEFAULT_ARRIVAL_RADIUS_METERS } from '../models/Place';

/** Which screen opened Review (04) — spec: "04 Back returns to whichever screen opened it". */
export type DraftOrigin = 'home' | 'where-to';

export interface JourneyDraft {
  destination: Place | null;
  /** Set when the destination came from a saved place, so arrival radius and naming follow it. */
  savedPlaceId: string | null;
  travelMode: TravelMode;
  arrivalRadiusMeters: number;
  /** State of screen 04's "Save as a place" switch. Only meaningful for unsaved places. */
  saveAsPlace: boolean;
  origin: DraftOrigin;
}

const EMPTY_DRAFT: JourneyDraft = {
  destination: null,
  savedPlaceId: null,
  travelMode: 'walk',
  arrivalRadiusMeters: DEFAULT_ARRIVAL_RADIUS_METERS,
  saveAsPlace: false,
  origin: 'home',
};

interface JourneyDraftContextValue {
  draft: JourneyDraft;
  /** Starts a fresh draft around a chosen destination and opens the review step. */
  setDestination(
    destination: Place,
    options?: { savedPlaceId?: string | null; origin?: DraftOrigin; arrivalRadiusMeters?: number },
  ): void;
  setTravelMode(mode: TravelMode): void;
  setSaveAsPlace(save: boolean): void;
  reset(): void;

  /**
   * Screen 02's search state, held here rather than in the screen so going
   * 02 → 03 (add an address) → back → 02 returns to the same query and
   * results, which the spec requires ("02 keeps the typed query and
   * results").
   */
  search: { query: string; results: PlaceSuggestion[] };
  rememberSearch(query: string, results: PlaceSuggestion[]): void;
  clearSearch(): void;

  /**
   * Saved place awaiting an address — set when the user taps "+ Add address"
   * on screen 02, read by screen 03, and cleared once saved. Also carries the
   * id to highlight on return ("03 Save returns to 02 and highlights the
   * updated place").
   */
  pendingAddressPlaceId: string | null;
  setPendingAddressPlaceId(id: string | null): void;
  highlightedPlaceId: string | null;
  setHighlightedPlaceId(id: string | null): void;

  /**
   * Coordinates the map picker dropped, waiting for screen 03 to name them.
   *
   * Handed over here rather than as navigation params: the picker goes *back*
   * to the screen that opened it, and `router.back()` can't carry params.
   * Replacing the route to attach them instead would leave a duplicate entry
   * in the tab navigator's history and break the back rules in §3.
   */
  pendingPin: Coordinates | null;
  setPendingPin(pin: Coordinates | null): void;
}

const notMounted = () => {
  throw new Error('JourneyDraftContext not mounted.');
};

const JourneyDraftContext = createContext<JourneyDraftContextValue>({
  draft: EMPTY_DRAFT,
  setDestination: notMounted,
  setTravelMode: notMounted,
  setSaveAsPlace: notMounted,
  reset: notMounted,
  search: { query: '', results: [] },
  rememberSearch: notMounted,
  clearSearch: notMounted,
  pendingAddressPlaceId: null,
  setPendingAddressPlaceId: notMounted,
  highlightedPlaceId: null,
  setHighlightedPlaceId: notMounted,
  pendingPin: null,
  setPendingPin: notMounted,
});

export function JourneyDraftStateProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<JourneyDraft>(EMPTY_DRAFT);
  const [search, setSearch] = useState<{ query: string; results: PlaceSuggestion[] }>({
    query: '',
    results: [],
  });
  const [pendingAddressPlaceId, setPendingAddressPlaceId] = useState<string | null>(null);
  const [highlightedPlaceId, setHighlightedPlaceId] = useState<string | null>(null);
  const [pendingPin, setPendingPin] = useState<Coordinates | null>(null);

  /**
   * Stable identity, and a no-op when nothing actually changed.
   *
   * Screen 02 calls this from an effect keyed on its own query/results. Wrote
   * naively — a fresh arrow in the context value, always storing a new object
   * — every call would change the context value, re-run that effect, and
   * store again: an infinite render loop.
   */
  const rememberSearch = useCallback((query: string, results: PlaceSuggestion[]) => {
    setSearch((current) =>
      current.query === query && current.results === results ? current : { query, results },
    );
  }, []);

  const clearSearch = useCallback(() => {
    setSearch((current) =>
      current.query === '' && current.results.length === 0 ? current : { query: '', results: [] },
    );
  }, []);

  const setDestination = useCallback<JourneyDraftContextValue['setDestination']>(
    (destination, options) => {
      setDraft((current) => ({
        ...current,
        destination,
        savedPlaceId: options?.savedPlaceId ?? null,
        origin: options?.origin ?? current.origin,
        arrivalRadiusMeters: options?.arrivalRadiusMeters ?? DEFAULT_ARRIVAL_RADIUS_METERS,
        // A destination that's already saved can't be saved again — the
        // switch on screen 04 is hidden in that case, so default it off.
        saveAsPlace: false,
      }));
    },
    [],
  );

  const value = useMemo<JourneyDraftContextValue>(
    () => ({
      draft,
      setDestination,
      setTravelMode: (travelMode) => setDraft((c) => ({ ...c, travelMode })),
      setSaveAsPlace: (saveAsPlace) => setDraft((c) => ({ ...c, saveAsPlace })),
      reset: () => {
        setDraft(EMPTY_DRAFT);
        setSearch({ query: '', results: [] });
        setPendingAddressPlaceId(null);
        setHighlightedPlaceId(null);
        setPendingPin(null);
      },
      search,
      rememberSearch,
      clearSearch,
      pendingAddressPlaceId,
      setPendingAddressPlaceId,
      highlightedPlaceId,
      setHighlightedPlaceId,
      pendingPin,
      setPendingPin,
    }),
    [draft, search, pendingAddressPlaceId, highlightedPlaceId, pendingPin, setDestination, rememberSearch, clearSearch],
  );

  return <JourneyDraftContext.Provider value={value}>{children}</JourneyDraftContext.Provider>;
}

export function useJourneyDraft(): JourneyDraftContextValue {
  return useContext(JourneyDraftContext);
}
