import type { Coordinates } from './Journey';

/**
 * A resolved destination.
 *
 * Per JOURNEY_FLOW_SPEC §3: every destination is stored as name +
 * formattedAddress + postcode + lat/lng + placeId — **never** only the typed
 * text. A journey whose destination is just a string can't be routed to,
 * can't fire an arrival geofence, and gives a guardian nothing to act on, so
 * the type deliberately makes coordinates non-optional.
 */
export interface Place {
  /** Short display name — "Riverside Primary School", "Home", "12 Acacia Avenue". */
  name: string;
  /** Full single-line address as returned by the provider. */
  formattedAddress: string;
  /**
   * Postcode component, when the provider supplies one. Null for places
   * outside postcode-covered regions or when the provider omits it — never
   * scraped back out of formattedAddress by guesswork.
   */
  postcode: string | null;
  coordinates: Coordinates;
  /**
   * Provider-issued identifier, used to re-fetch details later. Null when the
   * place came from a map pin-drop rather than the places provider (there's
   * no upstream record to point at in that case).
   */
  placeId: string | null;
}

/** How far from `coordinates` still counts as "arrived". Spec default: 100 m. */
export const DEFAULT_ARRIVAL_RADIUS_METERS = 100;

/** Options offered when the user taps "Change" on the arrival radius (screen 03). */
export const ARRIVAL_RADIUS_OPTIONS_METERS = [50, 100, 200, 500] as const;

/** Built-in saved-place slots. `custom` covers anything the user names themselves. */
export type SavedPlaceKind = 'home' | 'work' | 'school' | 'custom';

/**
 * A place the user has saved for one-tap reuse (screen 02's "Your places").
 *
 * `place` is nullable on purpose: the design seeds named slots ("School")
 * that have no address yet and render a "+ Add address" affordance, which
 * routes to screen 03. A saved place without an address can be named and
 * listed, but never started as a journey.
 */
export interface SavedPlace {
  id: string;
  name: string;
  kind: SavedPlaceKind;
  /** Null until the user adds an address (screen 03). */
  place: Place | null;
  arrivalRadiusMeters: number;
  createdAt: Date;
}

/** A search hit from the places provider, before it is resolved into a Place. */
export interface PlaceSuggestion {
  /** Provider id — pass to `PlacesProvider.getPlaceDetails` to resolve coordinates. */
  placeId: string;
  /** Bold first line: "Riverside Primary School". */
  primaryText: string;
  /** Grey second line: "Mill Lane, London SE15 4AB". */
  secondaryText: string;
  /**
   * Straight-line metres from the user's location, when a location was
   * supplied to the search. Null otherwise — never rendered as "0 km".
   */
  distanceMeters: number | null;
  /**
   * Set when the provider already returned full coordinates with the
   * suggestion (postcode lookups and pin-drops do). Lets the UI skip the
   * extra details round-trip.
   */
  resolved: Place | null;
}

/** How the user is travelling — drives routing profile and ETA (screen 04). */
export type TravelMode = 'walk' | 'bus' | 'bike' | 'car';

export const TRAVEL_MODES: Array<{ mode: TravelMode; label: string }> = [
  { mode: 'walk', label: 'Walk' },
  { mode: 'bus', label: 'Bus' },
  { mode: 'bike', label: 'Bike' },
  { mode: 'car', label: 'Car' },
];

/**
 * UK postcode, full ("SE15 4AB") or outward-only ("SE15"). Matching the
 * outward half matters because the spec wants "type a postcode → list of
 * addresses at that postcode" to start working before the user has typed the
 * whole thing.
 */
const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?(\s*\d[A-Z]{2})?$/i;

export function looksLikePostcode(query: string): boolean {
  return UK_POSTCODE_RE.test(query.trim());
}

/** True only for a complete postcode ("SE15 4AB"), not an outward code. */
export function isFullPostcode(query: string): boolean {
  return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(query.trim());
}

/** Normalises "se154ab" → "SE15 4AB" for display and provider lookups. */
export function formatPostcode(raw: string): string {
  const compact = raw.replace(/\s+/g, '').toUpperCase();
  if (compact.length < 5) return compact;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

/** "1.4 km" / "620 m" — the distance shown on each search result. */
export function formatDistance(meters: number | null): string | null {
  if (meters === null) return null;
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Straight-line distance between two points, in metres. */
export function haversineMeters(a: Coordinates, b: Coordinates): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const x =
    sinDLat * sinDLat +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinDLon * sinDLon;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
