import type { Coordinates } from '../models/Journey';
import type { Place, PlaceSuggestion } from '../models/Place';

/**
 * Address/place lookup, abstracted so the concrete service can be swapped
 * without touching a screen — JOURNEY_FLOW_SPEC §3 explicitly requires this
 * ("Choose one; wrap it in a PlacesService so it can be swapped").
 *
 * Concrete implementations:
 *  - MockPlacesProvider   — local fixtures, no key, no network (dev / CI)
 *  - GooglePlacesProvider — Places API (New): Autocomplete + Place Details
 *
 * A UK-postcode-only provider (getAddress.io, Ideal Postcodes, OS Places)
 * fits the same interface: `searchPlaces` returns the addresses at a
 * postcode, and `getPlaceDetails` is a no-op that echoes back the already
 * resolved suggestion.
 */
export interface PlacesProvider {
  /**
   * Free-text search: place name, street address, or postcode.
   *
   * @param query  Raw user input. Callers debounce and enforce the
   *               minimum-length rule; providers should not re-implement it.
   * @param near   User's position, used to bias and distance-rank results.
   *               Null when location isn't available yet.
   * @param signal Aborts an in-flight request when the query changes.
   */
  searchPlaces(
    query: string,
    near: Coordinates | null,
    signal?: AbortSignal,
  ): Promise<PlaceSuggestion[]>;

  /**
   * Resolves a suggestion into a full Place with coordinates.
   * Only called for suggestions whose `resolved` field is null.
   */
  getPlaceDetails(placeId: string, signal?: AbortSignal): Promise<Place>;

  /**
   * Names the coordinates behind a dropped map pin ("Choose on map instead").
   * Implementations that can't reverse-geocode should still return a Place —
   * with a coordinate-derived name — rather than throwing, so the map picker
   * always produces a usable destination.
   */
  reverseGeocode(coordinates: Coordinates, signal?: AbortSignal): Promise<Place>;
}
