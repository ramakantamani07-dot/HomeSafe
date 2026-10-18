import { completePlaces, resolvePlace, type NativeCompletion } from '../../../modules/place-search';
import type { Coordinates } from '../../models/Journey';
import type { Place, PlaceSuggestion } from '../../models/Place';
import type { PlacesProvider } from '../../providers/PlacesProvider';

/**
 * Place and address search from Apple's MapKit — free, keyless, iOS only.
 *
 * Suggests places ("King's College Hospital") and addresses as the person
 * types, which the system geocoder cannot, and which Google Places would only
 * do for a billed key. Naming a dropped map pin stays with the geocoder, which
 * does that well (`reverseGeocode` is delegated).
 *
 * Only the typed text and the person's rough position go to Apple, the same as
 * a search in Apple Maps.
 */
export class MapKitPlacesProvider implements PlacesProvider {
  /** Where the last search was biased; reused to resolve a suggestion from it. */
  private lastNear: Coordinates | null = null;

  constructor(private readonly pinNamer: Pick<PlacesProvider, 'reverseGeocode'>) {}

  async searchPlaces(
    query: string,
    near: Coordinates | null,
    signal?: AbortSignal,
  ): Promise<PlaceSuggestion[]> {
    this.lastNear = near;
    const completions = await completePlaces(query, near);
    throwIfAborted(signal);
    return toSuggestions(completions);
  }

  async getPlaceDetails(placeId: string, signal?: AbortSignal): Promise<Place> {
    const { title, subtitle } = decodePlaceId(placeId);
    const resolved = await resolvePlace(title, subtitle, this.lastNear);
    throwIfAborted(signal);
    return {
      name: resolved.name,
      formattedAddress: resolved.formattedAddress,
      postcode: resolved.postcode ?? null,
      coordinates: { latitude: resolved.latitude, longitude: resolved.longitude },
      placeId,
    };
  }

  reverseGeocode(coordinates: Coordinates, signal?: AbortSignal): Promise<Place> {
    return this.pinNamer.reverseGeocode(coordinates, signal);
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error('Search was cancelled.');
    error.name = 'AbortError';
    throw error;
  }
}

/**
 * MapKit gives no stable id for a suggestion, so the id is the suggestion's
 * own text, which `getPlaceDetails` searches for again. A unit separator
 * keeps the two parts apart: neither a name nor an address contains one.
 */
const SEPARATOR = '\u001F';
const PREFIX = 'mapkit:';

export function encodePlaceId(completion: NativeCompletion): string {
  return `${PREFIX}${completion.title}${SEPARATOR}${completion.subtitle}`;
}

export function decodePlaceId(placeId: string): NativeCompletion {
  const body = placeId.startsWith(PREFIX) ? placeId.slice(PREFIX.length) : placeId;
  const [title, subtitle = ''] = body.split(SEPARATOR);
  return { title, subtitle };
}

/**
 * Apple's suggestions as the app's. MapKit also suggests searches rather than
 * places ("Coffee — Search Nearby"); those have no address and go nowhere
 * on their own, so they are left out. Duplicates are dropped.
 */
export function toSuggestions(completions: NativeCompletion[]): PlaceSuggestion[] {
  const seen = new Set<string>();
  const out: PlaceSuggestion[] = [];
  for (const c of completions) {
    const title = c.title.trim();
    const subtitle = c.subtitle.trim();
    if (!title) continue;
    if (!subtitle || /^search nearby$/i.test(subtitle)) continue;
    const key = `${title}|${subtitle}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      placeId: encodePlaceId({ title, subtitle }),
      primaryText: title,
      secondaryText: subtitle,
      // MapKit's suggestions carry no coordinates; a distance would need a
      // lookup per row. Null is never shown as "0 km".
      distanceMeters: null,
      resolved: null,
    });
  }
  return out;
}
