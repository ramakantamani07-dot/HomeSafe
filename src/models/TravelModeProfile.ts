import type { AlertRules } from './AlertRules';
import type { TravelMode } from './Place';

/**
 * What each way of travelling means for a journey (docs/features/rides.md,
 * Phase 1): which kind of route to fetch, how long it takes, how patient the
 * safety checks are, and how often the phone reports where it is.
 *
 * One table, pure, so every rule for a mode is in one place and tested —
 * rather than "walk" being assumed by the route, the ETA and the checks.
 */

/** The kind of route a routing provider is asked for. */
export type RoutingProfile = 'walking' | 'driving';

/** Rides someone else drives. Booked in a ride app, or flagged on the street. */
export const RIDE_MODES: readonly TravelMode[] = ['cab', 'auto', 'bikeTaxi'];

export function isRide(mode: TravelMode): boolean {
  return RIDE_MODES.includes(mode);
}

/**
 * Walking routes for walking; road routes for everything on wheels. A bicycle
 * and a bus follow roads too — their *time* is derived below, since no free
 * cycling or bus router is available.
 */
export function routingProfile(mode: TravelMode): RoutingProfile {
  return mode === 'walk' ? 'walking' : 'driving';
}

/** A steady walking pace, used only when a walking route's time is unavailable. */
export const WALKING_SPEED_MPS = 1.35;

/**
 * Modes whose time is derived from the route's distance rather than taken from
 * the router. Bus is deliberately slower than a bike: it includes waiting and
 * stopping, which is what makes a bus ETA honest rather than optimistic.
 */
const DERIVED_SPEED_MPS: Partial<Record<TravelMode, number>> = {
  bike: 4.2,
  bus: 5.0,
};

export function derivedSpeedMps(mode: TravelMode): number | null {
  return DERIVED_SPEED_MPS[mode] ?? null;
}

/**
 * How long a ride may take to turn up before "late" applies (AP1: "~10 min
 * pickup"). Rides only. Counted from the journey's start, so a ride that never
 * comes still raises a check after the allowance and the usual late margin.
 */
export const PICKUP_ALLOWANCE_MINUTES = 10;

export function pickupAllowanceMinutes(mode: TravelMode): number {
  return isRide(mode) ? PICKUP_ALLOWANCE_MINUTES : 0;
}

/**
 * Expected arrival. For a ride waiting to be picked up, the drive starts no
 * earlier than the end of the pickup allowance. Once the traveller says they
 * are in (`rideConfirmedAt`), the allowance is over: the drive starts then.
 */
export function expectedArrival(
  mode: TravelMode,
  driveSeconds: number,
  calculatedAt: Date,
  journeyStartedAt: Date,
  rideConfirmedAt: Date | null = null,
): Date {
  const pickupDone = rideConfirmedAt
    ? rideConfirmedAt.getTime()
    : journeyStartedAt.getTime() + pickupAllowanceMinutes(mode) * 60_000;
  const departs = Math.max(calculatedAt.getTime(), pickupDone);
  return new Date(departs + driveSeconds * 1000);
}

/** "~10 min pickup + 14 min drive" (AP1), or null when there is no pickup. */
export function rideDurationLabel(mode: TravelMode, driveSeconds: number): string | null {
  const pickup = pickupAllowanceMinutes(mode);
  if (pickup === 0) return null;
  return `~${pickup} min pickup + ${Math.max(1, Math.round(driveSeconds / 60))} min drive`;
}

/**
 * How far from the planned route counts as "off route". On foot a detour of a
 * few streets is notable; a driver routinely takes another main road, and a
 * bus follows its own line.
 */
const OFF_ROUTE_METERS: Record<TravelMode, number> = {
  walk: 300,
  bike: 300,
  bus: 800,
  car: 600,
  cab: 600,
  auto: 600,
  bikeTaxi: 600,
};

export function offRouteThresholdMeters(mode: TravelMode): number {
  return OFF_ROUTE_METERS[mode];
}

/** Traffic and pickups mean a ride sits still far longer than a walk does. */
export const VEHICLE_STOPPED_MINUTES = 20;

/**
 * The person's alert rules, adjusted for how they are travelling. Only ever
 * more patient than their own setting for vehicles, never less: a stop in
 * traffic is not a reason to ask if someone is OK.
 */
export function alertRulesFor(mode: TravelMode, rules: AlertRules): AlertRules {
  if (mode === 'walk' || mode === 'bike') return rules;
  return { ...rules, stoppedMinutes: Math.max(rules.stoppedMinutes, VEHICLE_STOPPED_MINUTES) };
}

/** How the OS should tune location for this mode. */
export function trackingMotion(mode: TravelMode): 'pedestrian' | 'vehicle' {
  return mode === 'walk' || mode === 'bike' ? 'pedestrian' : 'vehicle';
}
