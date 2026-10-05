import type { Coordinates } from '../../models/Journey';
import type { Place, PlaceSuggestion } from '../../models/Place';
import { haversineMeters, looksLikePostcode } from '../../models/Place';
import type { PlacesProvider } from '../../providers/PlacesProvider';

/**
 * Google Places API (New) — Autocomplete + Place Details, plus the Geocoding
 * API for reverse-geocoding a dropped pin.
 *
 * Needs a key with "Places API (New)" and "Geocoding API" enabled. Supply it
 * as EXPO_PUBLIC_GOOGLE_PLACES_API_KEY; AppProviders falls back to
 * MockPlacesProvider when it's absent, so the app stays runnable without one.
 *
 * The key ships in the JS bundle (that's what EXPO_PUBLIC_ means) — restrict
 * it by bundle id / package name + API in Google Cloud Console. An
 * unrestricted key is a billing incident waiting to happen.
 */

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const DETAILS_URL = 'https://places.googleapis.com/v1/places';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

/** Bias radius around the user's position, in metres. */
const LOCATION_BIAS_RADIUS = 30_000;

interface AutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId: string;
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
      text?: { text?: string };
    };
  }>;
  error?: { message?: string };
}

interface PlaceDetailsResponse {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
  error?: { message?: string };
}

interface GeocodeResponse {
  results?: Array<{
    place_id?: string;
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
    address_components?: Array<{ long_name?: string; types?: string[] }>;
  }>;
  status?: string;
  error_message?: string;
}

function postcodeFromNewApi(
  components: PlaceDetailsResponse['addressComponents'],
): string | null {
  const match = components?.find((c) => c.types?.includes('postal_code'));
  return match?.longText ?? match?.shortText ?? null;
}

function postcodeFromGeocodeApi(
  components: NonNullable<GeocodeResponse['results']>[number]['address_components'],
): string | null {
  return components?.find((c) => c.types?.includes('postal_code'))?.long_name ?? null;
}

/**
 * Autocomplete returns "Mill Lane, London SE15 4AB" as one string when there
 * is no structured format (postcode queries often land here). Splitting the
 * first comma-separated chunk off as the name keeps the two-line result row
 * in the design readable rather than repeating the full address twice.
 */
function splitUnstructured(text: string): { primary: string; secondary: string } {
  const commaIndex = text.indexOf(',');
  if (commaIndex === -1) return { primary: text, secondary: '' };
  return {
    primary: text.slice(0, commaIndex).trim(),
    secondary: text.slice(commaIndex + 1).trim(),
  };
}

export class GooglePlacesProvider implements PlacesProvider {
  constructor(private readonly apiKey: string) {}

  async searchPlaces(
    query: string,
    near: Coordinates | null,
    signal?: AbortSignal,
  ): Promise<PlaceSuggestion[]> {
    const body: Record<string, unknown> = { input: query };

    if (near) {
      body.locationBias = {
        circle: {
          center: { latitude: near.latitude, longitude: near.longitude },
          radius: LOCATION_BIAS_RADIUS,
        },
      };
    }
    // A postcode query should return the addresses *at* that postcode, not
    // the postcode district as a single area result — restricting to
    // address-shaped types is what makes that happen.
    if (looksLikePostcode(query)) {
      body.includedPrimaryTypes = ['street_address', 'premise', 'subpremise', 'postal_code'];
    }

    const response = await fetch(AUTOCOMPLETE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
      },
      body: JSON.stringify(body),
      signal,
    });

    const json = (await response.json()) as AutocompleteResponse;
    if (!response.ok) {
      throw new Error(json.error?.message ?? 'Address search is unavailable right now.');
    }

    return (json.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
      .map((p) => {
        const main = p.structuredFormat?.mainText?.text;
        const secondary = p.structuredFormat?.secondaryText?.text;
        const fallback = splitUnstructured(p.text?.text ?? '');
        return {
          placeId: p.placeId,
          primaryText: main ?? fallback.primary,
          secondaryText: secondary ?? fallback.secondary,
          // Autocomplete doesn't return coordinates — distance is filled in
          // by PlacesService once details resolve, rather than guessed here.
          distanceMeters: null,
          resolved: null,
        };
      });
  }

  async getPlaceDetails(placeId: string, signal?: AbortSignal): Promise<Place> {
    const response = await fetch(`${DETAILS_URL}/${encodeURIComponent(placeId)}`, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,addressComponents',
      },
      signal,
    });

    const json = (await response.json()) as PlaceDetailsResponse;
    if (!response.ok || json.location?.latitude === undefined || json.location?.longitude === undefined) {
      throw new Error(json.error?.message ?? 'That place could not be found. Please pick another.');
    }

    return {
      name: json.displayName?.text ?? json.formattedAddress ?? 'Destination',
      formattedAddress: json.formattedAddress ?? '',
      postcode: postcodeFromNewApi(json.addressComponents),
      coordinates: { latitude: json.location.latitude, longitude: json.location.longitude },
      placeId: json.id ?? placeId,
    };
  }

  async reverseGeocode(coordinates: Coordinates, signal?: AbortSignal): Promise<Place> {
    const url =
      `${GEOCODE_URL}?latlng=${coordinates.latitude},${coordinates.longitude}` +
      `&key=${encodeURIComponent(this.apiKey)}`;

    try {
      const response = await fetch(url, { signal });
      const json = (await response.json()) as GeocodeResponse;
      const top = json.results?.[0];

      if (response.ok && top) {
        const split = splitUnstructured(top.formatted_address ?? '');
        return {
          name: split.primary || 'Dropped pin',
          formattedAddress: top.formatted_address ?? '',
          postcode: postcodeFromGeocodeApi(top.address_components),
          // The pin the user placed wins over the geocoder's snapped
          // coordinate — they chose that exact spot on the map.
          coordinates,
          placeId: top.place_id ?? null,
        };
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
      // Fall through to the coordinate-only place below.
    }

    // Reverse geocoding is a nicety — a pin the user dropped themselves is
    // still a perfectly valid destination without a street name.
    return {
      name: 'Dropped pin',
      formattedAddress: `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`,
      postcode: null,
      coordinates,
      placeId: null,
    };
  }
}
