import type { StoredJourney } from '../shared/types';

/**
 * How alerts describe a ride (docs/features/rides.md, Phase 5). Mirrors the
 * app's `rideNoun` / `guardianRideStatus` (src/models/Ride.ts): "getting an
 * auto" until the traveller says she is in, then "in an auto" — never
 * inferred from a ride app having been opened.
 */

const RIDE_NOUN: Record<string, string> = {
  cab: 'a cab',
  auto: 'an auto',
  bikeTaxi: 'a bike taxi',
};

function rideNoun(journey: Pick<StoredJourney, 'travelMode' | 'ride'> | null | undefined): string | null {
  if (!journey?.ride) return null;
  return RIDE_NOUN[journey.travelMode ?? ''] ?? 'a ride';
}

/** "Priya is getting an auto to Home" — the journey-start alert, for a ride. */
export function journeyStartWording(
  name: string,
  destination: string,
  journey: Pick<StoredJourney, 'travelMode' | 'ride'>,
): { sms: string; title: string; body: string } {
  const noun = rideNoun(journey);
  if (!noun) {
    return {
      sms: `wayLoc: ${name} started a journey to ${destination}. You'll be told if they miss a check-in.`,
      title: `${name} is on the way`,
      body: `Heading to ${destination}.`,
    };
  }
  return {
    sms: `wayLoc: ${name} is getting ${noun} to ${destination}. You'll be told if they miss a check-in.`,
    title: `${name} is getting ${noun}`,
    body: `Heading to ${destination}.`,
  };
}

/**
 * The ride, for an SOS: " In an auto, vehicle KA 01 AB 1234." The vehicle
 * number is the most useful fact in a ride emergency, so it goes in whenever
 * the traveller gave one. Empty for a journey without a ride.
 */
export function rideSosDetail(journey: Pick<StoredJourney, 'travelMode' | 'ride'> | null | undefined): string {
  const noun = rideNoun(journey);
  if (!noun || !journey?.ride) return '';
  const vehicle = journey.ride.vehicleNumber?.trim();
  if (journey.ride.state === 'in_ride') {
    return vehicle ? ` In ${noun}, vehicle ${vehicle}.` : ` In ${noun}.`;
  }
  // Not confirmed in it: say what is known, and the number if she gave one.
  return vehicle ? ` Was getting ${noun}, vehicle ${vehicle}.` : ` Was getting ${noun}.`;
}
