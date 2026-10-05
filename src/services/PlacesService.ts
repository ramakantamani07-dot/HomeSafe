import type { Coordinates } from '../models/Journey';
import type { Place, PlaceSuggestion } from '../models/Place';
import { haversineMeters } from '../models/Place';
import type { PlacesProvider } from '../providers/PlacesProvider';

/** Spec §3: "show results after 3 characters". */
export const MIN_QUERY_LENGTH = 3;

/**
 * Option 15 §3B tightens this from the journey-flow spec's ~300 ms to 250 ms.
 * Search now lives inside the sheet rather than on its own screen, so results
 * appear under the user's thumb as they type and a slower debounce reads as lag.
 */
export const SEARCH_DEBOUNCE_MS = 250;

/** Results beyond this are noise in a "where are you going" list. */
const MAX_RESULTS = 8;

/**
 * The single place the app talks to for address lookup.
 *
 * Owns the rules that must not differ between screens — minimum query length,
 * result capping, distance ranking, in-flight request cancellation — so
 * swapping the underlying provider (Google → Mapbox → getAddress.io) can
 * never quietly change search behaviour.
 */
export class PlacesService {
  private activeController: AbortController | null = null;
  private requestSeq = 0;

  constructor(private readonly provider: PlacesProvider) {}

  /** True when the query is long enough to search on. */
  shouldSearch(query: string): boolean {
    return query.trim().length >= MIN_QUERY_LENGTH;
  }

  /**
   * Searches for `query`, cancelling any previous in-flight search.
   *
   * Returns [] for queries below the minimum length rather than throwing, so
   * the caller can drive this straight from a text field's onChange.
   * Throws with `name === 'AbortError'` when superseded — callers should
   * ignore that case and keep whatever is already on screen.
   */
  async search(query: string, near: Coordinates | null): Promise<PlaceSuggestion[]> {
    if (!this.shouldSearch(query)) {
      this.cancelPendingSearch();
      return [];
    }

    this.activeController?.abort();
    const controller = new AbortController();
    this.activeController = controller;
    const seq = ++this.requestSeq;

    try {
      const results = await this.provider.searchPlaces(query, near, controller.signal);

      // A newer search started while this one was in flight — discard it so a
      // slow early keystroke can't overwrite results for the current query.
      if (this.requestSeq !== seq) {
        const err = new Error('Stale search response discarded');
        err.name = 'AbortError';
        throw err;
      }

      return this.rank(results, near).slice(0, MAX_RESULTS);
    } finally {
      if (this.activeController === controller) this.activeController = null;
    }
  }

  /** Aborts the in-flight search, if any. Call when the search screen closes. */
  cancelPendingSearch(): void {
    this.activeController?.abort();
    this.activeController = null;
    this.requestSeq++;
  }

  /**
   * Turns a suggestion into a full Place. Suggestions that already carry
   * coordinates skip the provider round-trip entirely.
   */
  async resolve(suggestion: PlaceSuggestion): Promise<Place> {
    if (suggestion.resolved) return suggestion.resolved;
    return this.provider.getPlaceDetails(suggestion.placeId);
  }

  /** Names the coordinates behind a dropped map pin. */
  async describeCoordinates(coordinates: Coordinates): Promise<Place> {
    return this.provider.reverseGeocode(coordinates);
  }

  /**
   * Straight-line distance from `near` to a resolved place, for the "· 1.4 km"
   * suffix on a result row. Null when either side is unknown — the UI omits
   * the suffix rather than showing a fabricated number.
   */
  distanceTo(place: Place, near: Coordinates | null): number | null {
    if (!near) return null;
    return haversineMeters(near, place.coordinates);
  }

  /**
   * Distance-ranks results that carry coordinates. Suggestions without them
   * (plain Google autocomplete predictions) keep the provider's own relevance
   * order, which is better than an arbitrary reshuffle.
   */
  private rank(results: PlaceSuggestion[], near: Coordinates | null): PlaceSuggestion[] {
    if (!near) return results;

    const withDistance = results.map((s) =>
      s.resolved && s.distanceMeters === null
        ? { ...s, distanceMeters: haversineMeters(near, s.resolved.coordinates) }
        : s,
    );

    if (withDistance.every((s) => s.distanceMeters !== null)) {
      return withDistance.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
    }
    return withDistance;
  }
}
