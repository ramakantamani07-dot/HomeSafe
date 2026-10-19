import type { Place, TravelMode } from './Place';
import { PICKUP_ALLOWANCE_MINUTES, isRide } from './TravelModeProfile';

/**
 * A ride on a journey — cab, auto or bike taxi (docs/features/rides.md,
 * Phase 2). WayLoc never books the ride and is never told about it by the ride
 * app, so everything here is either what WayLoc did itself or what the
 * traveller said. Nothing is inferred.
 *
 *   getting_ride ──"Yes, I'm in"──▶ in_ride ──arrival──▶ (journey ends)
 *
 * The journey is already running while the traveller waits (decision 1); the
 * ride only changes how it is described and how patient the checks are.
 */

export type RideState = 'getting_ride' | 'in_ride';

/** Ride apps WayLoc can hand off to (Phase 3). */
export type RideApp = 'uber' | 'ola' | 'rapido';

/** What the traveller said they booked with, when asked. `other` covers a street auto. */
export type RideBookedWith = RideApp | 'other';

export interface Ride {
  state: RideState;
  /** The ride app WayLoc opened, if it opened one. Null for "I'll sort it myself". */
  openedApp: RideApp | null;
  /**
   * What the traveller answered on "Yes, I'm in" — never assumed from
   * `openedApp`: opening Uber does not prove the ride is an Uber (departure 3).
   */
  bookedWith: RideBookedWith | null;
  /** When the traveller said they were in. */
  confirmedAt: Date | null;
  /** Optional, typed by the traveller. Deleted with the journey's trail. */
  vehicleNumber: string | null;
}

export const RIDE_APP_NAMES: Record<RideApp, string> = {
  uber: 'Uber',
  ola: 'Ola',
  rapido: 'Rapido',
};

/** How a journey in this mode begins: waiting for a ride, or no ride at all. */
export function initialRide(mode: TravelMode, openedApp: RideApp | null = null): Ride | null {
  if (!isRide(mode)) return null;
  return { state: 'getting_ride', openedApp, bookedWith: null, confirmedAt: null, vehicleNumber: null };
}

/**
 * "Yes, I'm in". Asks which app only when WayLoc opened one — otherwise the
 * traveller sorted it themselves and there is nothing to ask.
 */
export function needsBookedWithQuestion(ride: Ride): boolean {
  return ride.state === 'getting_ride' && ride.openedApp !== null;
}

export function confirmInRide(ride: Ride, now: Date, bookedWith: RideBookedWith | null = null): Ride {
  return { ...ride, state: 'in_ride', confirmedAt: now, bookedWith: bookedWith ?? ride.bookedWith };
}

/**
 * The ride a journey has after "Change travel". A new ride mode starts waiting
 * again (the old ride did not come); anything else has no ride. The vehicle
 * number belonged to the old ride, so it goes.
 */
export function rideAfterModeChange(mode: TravelMode): Ride | null {
  return initialRide(mode);
}

// ── Pickup allowance ───────────────────────────────────────────────────────

/** Whole minutes of pickup allowance left, or 0 once it has run out. */
export function pickupMinutesLeft(journeyStartedAt: Date, now: Date): number {
  const ends = journeyStartedAt.getTime() + PICKUP_ALLOWANCE_MINUTES * 60_000;
  return Math.max(0, Math.ceil((ends - now.getTime()) / 60_000));
}

// ── Wording ────────────────────────────────────────────────────────────────

const RIDE_NOUN: Partial<Record<TravelMode, string>> = {
  cab: 'a cab',
  auto: 'an auto',
  bikeTaxi: 'a bike taxi',
};

/** "an auto", "a cab", "a bike taxi". */
export function rideNoun(mode: TravelMode): string {
  return RIDE_NOUN[mode] ?? 'a ride';
}

/** "auto", "cab", "bike taxi" — after "the". */
export function rideNounBare(mode: TravelMode): string {
  return rideNoun(mode).replace(/^an? /, '');
}

/**
 * Where the ride is going, for the traveller's own screen: the postcode when
 * there is one, else the place's name. (Never sent to a ride app — see
 * `rideDestinationAddress` for that.)
 */
function shortDestination(destination: Place | null, label: string): string {
  return destination?.postcode ?? destination?.name ?? label;
}

/** AP3 / AP4 headline: "Getting an auto" / "In an auto to NN2 8ET". */
export function rideHeadline(ride: Ride, mode: TravelMode, destination: Place | null, label: string): string {
  const noun = rideNoun(mode);
  if (ride.state === 'getting_ride') return `Getting ${noun}`;
  return `In ${noun} to ${shortDestination(destination, label)}`;
}

function clock(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * AP3 / AP4 subtitle. Only facts: the allowance WayLoc set, the time the
 * traveller confirmed, and the app they said — never "booked with Uber" just
 * because Uber was opened.
 */
export function rideSubtitle(ride: Ride, journeyStartedAt: Date, now: Date): string {
  if (ride.state === 'getting_ride') {
    const left = pickupMinutesLeft(journeyStartedAt, now);
    return left > 0
      ? `Safe Journey on · pickup allowance ${left} min left`
      : 'Safe Journey on · pickup allowance used';
  }
  const parts = [ride.confirmedAt ? `Confirmed ${clock(ride.confirmedAt)}` : 'Confirmed'];
  if (ride.bookedWith && ride.bookedWith !== 'other') parts.push(`booked with ${RIDE_APP_NAMES[ride.bookedWith]}`);
  return parts.join(' · ');
}

/**
 * The AP3 card's question. Once the allowance has gone it becomes "Still
 * waiting for your auto?" — on this phone only. It never alerts anyone by
 * itself (departure 4); the usual late check takes over later.
 */
export function rideQuestion(mode: TravelMode, journeyStartedAt: Date, now: Date): string {
  return pickupMinutesLeft(journeyStartedAt, now) > 0
    ? `Are you in the ${rideNounBare(mode)} now?`
    : `Still waiting for your ${rideNounBare(mode)}?`;
}

// ── Destination for a ride app or the clipboard ────────────────────────────

/**
 * The address a ride app (or the clipboard) may be given: the street address,
 * else the postcode. **Never** the place's WayLoc name — "Home" or "Mum's
 * house" tells a third party something personal (decision 4). Null when there
 * is no address to give.
 */
export function rideDestinationAddress(destination: Place | null): string | null {
  const address = destination?.formattedAddress?.trim();
  if (address) return address;
  return destination?.postcode?.trim() || null;
}

// ── Vehicle number ─────────────────────────────────────────────────────────

/** Letters and digits in an Indian plate ("MH12AB1234" is 10; BH series is 10). */
export const VEHICLE_NUMBER_MAX_CHARS = 12;

/**
 * What the traveller typed, as stored: upper-cased, letters, digits and single
 * spaces only, at most 12 letters and digits. Free text, not validated as a
 * plate — formats vary and a wrong rejection at the kerb helps nobody. Null
 * when nothing usable is left.
 */
export function normaliseVehicleNumber(input: string): string | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  let count = 0;
  let out = '';
  for (const ch of cleaned) {
    if (ch !== ' ') {
      if (count === VEHICLE_NUMBER_MAX_CHARS) break;
      count += 1;
    }
    out += ch;
  }
  return out.trim();
}
