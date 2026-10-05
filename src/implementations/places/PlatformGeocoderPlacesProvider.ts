import * as Location from 'expo-location';

import type { Coordinates } from '../../models/Journey';
import type { Place, PlaceSuggestion } from '../../models/Place';
import { formatPostcode, haversineMeters } from '../../models/Place';
import type { PlacesProvider } from '../../providers/PlacesProvider';

/**
 * Address lookup through the **operating system's own geocoder** — CLGeocoder
 * on iOS, Android's Geocoder on Android.
 *
 * Why this exists: the Google Places adapter needs a billed API key, and until
 * one exists the only alternative was `MockPlacesProvider`'s six fixture
 * addresses — so a real postcode typed on a real device returned "nothing
 * matched". The OS already ships a geocoder that resolves exactly that, for
 * free, with no key and no account, which is the same reason the map uses
 * Apple Maps via PROVIDER_DEFAULT.
 *
 * **What it does and does not do.** This resolves addresses and postcodes,
 * which is what the spec's search is primarily for ("type a postcode → the
 * addresses at it"). It is *not* a point-of-interest autocomplete: the OS
 * geocoder has no notion of "coffee shops near me" and will not predict
 * partial business names. That is a genuine capability gap versus Google
 * Places, not a bug here — `GooglePlacesProvider` still takes over the moment
 * a key is configured, and nothing else in the app changes when it does.
 */
export class PlatformGeocoderPlacesProvider implements PlacesProvider {
  /**
   * Geocoders are rate-limited per app — CLGeocoder throttles aggressively and
   * starts failing requests rather than queueing them. Each hit costs one
   * reverse-geocode to recover its address text, so the cap bounds that fan-out.
   * Address searches realistically return one or two hits anyway.
   */
  private static readonly MAX_RESULTS = 5;

  async searchPlaces(
    query: string,
    near: Coordinates | null,
    signal?: AbortSignal,
  ): Promise<PlaceSuggestion[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const hits = await this.geocode(trimmed);
    throwIfAborted(signal);

    const suggestions: PlaceSuggestion[] = [];

    // Sequential, not Promise.all: concurrent reverse-geocodes are the fastest
    // way to trip the OS throttle, and a throttled geocoder fails the whole
    // search rather than degrading.
    for (const hit of hits.slice(0, PlatformGeocoderPlacesProvider.MAX_RESULTS)) {
      throwIfAborted(signal);

      const coordinates: Coordinates = {
        latitude: hit.latitude,
        longitude: hit.longitude,
      };
      const place = await this.describe(coordinates, trimmed);

      suggestions.push({
        placeId: encodeCoordinateId(coordinates),
        primaryText: place.name,
        secondaryText: place.formattedAddress,
        distanceMeters: near ? haversineMeters(near, coordinates) : null,
        // Already resolved — the OS geocoder hands back coordinates with the
        // hit, so the UI never needs a second details round-trip.
        resolved: place,
      });
    }

    return suggestions;
  }

  /**
   * Suggestions from this provider always arrive resolved, so `PlacesService`
   * never calls this. It is implemented rather than thrown from because the id
   * is self-describing: it carries the coordinates, so a details lookup is just
   * a reverse-geocode and the contract holds even if a caller does reach it.
   */
  async getPlaceDetails(placeId: string, signal?: AbortSignal): Promise<Place> {
    const coordinates = decodeCoordinateId(placeId);
    if (!coordinates) {
      throw new Error(`Unrecognised place id for the platform geocoder: ${placeId}`);
    }
    throwIfAborted(signal);
    return this.describe(coordinates, null);
  }

  async reverseGeocode(coordinates: Coordinates, signal?: AbortSignal): Promise<Place> {
    throwIfAborted(signal);
    return this.describe(coordinates, null);
  }

  /** Forward geocode, treating "found nothing" as an empty list rather than an error. */
  private async geocode(query: string): Promise<Location.LocationGeocodedLocation[]> {
    try {
      return await Location.geocodeAsync(query);
    } catch {
      // Both platforms throw for "no match" as readily as for a real failure,
      // and the two are indistinguishable here. An empty list renders the
      // screen's existing "nothing matched" state, which is the truthful
      // outcome either way.
      return [];
    }
  }

  /**
   * Names a coordinate. Per the port contract this must always return a Place
   * rather than throw — a pin-drop has to produce a usable destination even
   * when the geocoder has nothing to say about that spot.
   */
  private async describe(coordinates: Coordinates, fallbackName: string | null): Promise<Place> {
    let address: Location.LocationGeocodedAddress | null = null;
    try {
      const [first] = await Location.reverseGeocodeAsync(coordinates);
      address = first ?? null;
    } catch {
      address = null;
    }

    if (!address) {
      return {
        name: fallbackName ?? describeCoordinates(coordinates),
        formattedAddress: describeCoordinates(coordinates),
        postcode: null,
        coordinates,
        placeId: encodeCoordinateId(coordinates),
      };
    }

    const street = [address.streetNumber, address.street].filter(Boolean).join(' ');
    const postcode = address.postalCode ? formatPostcode(address.postalCode) : null;

    // iOS populates `formattedAddress` inconsistently, so it is used when
    // present and otherwise composed from the parts — never scraped apart.
    const composed =
      address.formattedAddress ??
      [street, address.city, address.region, postcode].filter(Boolean).join(', ');

    return {
      name: address.name ?? street ?? address.city ?? fallbackName ?? describeCoordinates(coordinates),
      formattedAddress: composed || describeCoordinates(coordinates),
      postcode,
      coordinates,
      placeId: encodeCoordinateId(coordinates),
    };
  }
}

/**
 * The OS geocoder issues no stable identifiers, so the id carries the
 * coordinates it describes. That keeps `getPlaceDetails` honest without
 * inventing a cache that would have to be invalidated.
 */
const COORDINATE_ID_PREFIX = 'geo:';

function encodeCoordinateId({ latitude, longitude }: Coordinates): string {
  return `${COORDINATE_ID_PREFIX}${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

function decodeCoordinateId(placeId: string): Coordinates | null {
  if (!placeId.startsWith(COORDINATE_ID_PREFIX)) return null;
  const [lat, lng] = placeId.slice(COORDINATE_ID_PREFIX.length).split(',').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat, longitude: lng };
}

/** Last-resort human-readable label when the geocoder knows nothing. */
function describeCoordinates({ latitude, longitude }: Coordinates): string {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

/**
 * expo-location has no AbortSignal support, so cancellation is enforced at the
 * await boundaries instead. `PlacesService` keys its staleness check on the
 * error name, so this must match what fetch would have thrown.
 */
function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const error = new Error('Search aborted');
  error.name = 'AbortError';
  throw error;
}
