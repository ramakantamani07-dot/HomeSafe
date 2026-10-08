import type { Coordinates } from './Journey';

/**
 * Somewhere to head for when you feel uneasy (Option 15 `AI5`, "Nearest open").
 *
 * **Why these categories and no others.** The spec asks for places that are
 * *open*. Apple's MapKit — which is what finds these, for free — publishes no
 * opening hours at all, and neither does any keyless source. Rather than render
 * an "open now" badge we cannot stand behind, the search is restricted to
 * places that are staffed around the clock by their nature. A police station at
 * 2am is a safe assumption; a café at 2am is exactly the guess that would send
 * someone to a locked door.
 *
 * Cafés, shops and restaurants are therefore absent by design, not by oversight.
 * They return the moment a source with real opening hours exists — Google Places
 * has `opening_hours`, and the provider swap is one line. See decision D4 in
 * docs/plan/IMPLEMENTATION_PHASES.md.
 */
export type SafePlaceKind = 'police' | 'hospital' | 'fire' | 'pharmacy' | 'fuel' | 'hotel';

export interface SafePlace {
  id: string;
  name: string;
  kind: SafePlaceKind;
  coordinates: Coordinates;
  distanceMeters: number;
  /** Null when the provider has no number. Never fabricated. */
  phoneNumber: string | null;
}

/**
 * MapKit's category identifiers, mapped to ours.
 *
 * Kept here rather than in Swift so the policy about which categories are
 * trustworthy is testable, and so a second platform can reuse the same decision
 * instead of re-deriving it.
 */
export const SAFE_PLACE_CATEGORIES: Readonly<Record<string, SafePlaceKind>> = {
  MKPOICategoryPolice: 'police',
  MKPOICategoryHospital: 'hospital',
  MKPOICategoryFireStation: 'fire',
  MKPOICategoryPharmacy: 'pharmacy',
  MKPOICategoryGasStation: 'fuel',
  MKPOICategoryHotel: 'hotel',
};

/** The identifiers to ask MapKit for. */
export const SAFE_PLACE_CATEGORY_IDS = Object.keys(SAFE_PLACE_CATEGORIES);

/** How far out to look. Beyond this, "nearest" stops being useful on foot. */
export const SAFE_PLACE_RADIUS_METERS = 2_000;

/** Enough to choose from, few enough to read while walking. */
export const SAFE_PLACE_LIMIT = 5;

/** What each kind is called on screen. */
export const SAFE_PLACE_LABELS: Readonly<Record<SafePlaceKind, string>> = {
  police: 'Police station',
  hospital: 'Hospital',
  fire: 'Fire station',
  pharmacy: 'Pharmacy',
  fuel: 'Petrol station',
  hotel: 'Hotel',
};

/**
 * Ranks the safest kinds first, then by distance.
 *
 * Not purely nearest-first: a police station 600m away is a better destination
 * for a frightened person than a hotel 200m away, and sorting on distance alone
 * would bury it. Within a kind, nearer wins.
 */
const KIND_PRIORITY: Readonly<Record<SafePlaceKind, number>> = {
  police: 0,
  hospital: 1,
  fire: 2,
  pharmacy: 3,
  fuel: 4,
  hotel: 5,
};

export function rankSafePlaces(places: SafePlace[]): SafePlace[] {
  return [...places].sort((a, b) => {
    const byKind = KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind];
    return byKind !== 0 ? byKind : a.distanceMeters - b.distanceMeters;
  });
}
