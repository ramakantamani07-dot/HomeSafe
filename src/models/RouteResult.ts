/** A single point on a calculated route path. Same shape as Coordinates but semantically distinct. */
export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

/**
 * One leg of the route, as the timeline on screen `AI3` renders it.
 *
 * Deliberately a trimmed view of what a routing provider returns — turn-by-turn
 * manoeuvres, bearings and lane guidance are navigation data, and wayLoc is
 * not a navigation app. What a traveller and their guardian need is "which
 * roads, roughly how long", which is what this carries.
 */
export interface RouteStep {
  /** Road or path name. Null when the provider doesn't name it (alleys, paths). */
  name: string | null;
  distanceMeters: number;
  durationSeconds: number;
  /** Where the step begins — used to place it on the map if needed. */
  start: RouteCoordinate;
}

export interface RouteResult {
  /**
   * Opaque route identifier from the provider. Null when the provider does
   * not return one (e.g. OSRM's public demo server).
   */
  providerRouteId: string | null;
  /** Ordered waypoints forming the route path, ready to draw as a polyline. */
  coordinates: RouteCoordinate[];
  distanceMeters: number;
  durationSeconds: number;
  /**
   * Legs of the journey, longest-first significance preserved in order.
   * Empty when the provider wasn't asked for them or didn't supply any — the
   * timeline then falls back to start and arrival alone rather than inventing
   * intermediate steps.
   */
  steps: RouteStep[];
  calculatedAt: Date;
}

/**
 * Pure presentation helpers for a route.
 *
 * On the model rather than the service because they are pure functions of
 * their arguments — no provider, no network, no state. Living here means a
 * hook or screen that only needs to *format* a route never has to reach for a
 * service, which is what previously pulled a service import into the hook
 * layer and past the port boundary.
 *
 * `RoutingService` delegates to these so there is exactly one definition.
 */

/** When the traveller arrives, anchored to when the route was calculated. */
export function computeEta(durationSeconds: number, fromTime?: Date): Date {
  const base = fromTime ?? new Date();
  return new Date(base.getTime() + durationSeconds * 1_000);
}

/** "23 min", "1 h 5 min", "Less than a minute" */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return 'Less than a minute';
  const h = Math.floor(seconds / 3_600);
  const m = Math.floor((seconds % 3_600) / 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** "450 m", "1.2 km" */
export function formatDistance(meters: number): string {
  if (meters < 1_000) return `${Math.round(meters)} m`;
  return `${(meters / 1_000).toFixed(1)} km`;
}

/** "14:35" */
export function formatEta(eta: Date): string {
  return eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * The leg the traveller is currently on, chosen as the named step whose start
 * is nearest their position.
 *
 * **This is context, not navigation.** `RouteStep` deliberately carries no
 * manoeuvre, bearing or lane data (see its own note), so wayLoc cannot say
 * "turn left in 50 m" and does not pretend to — Option 15 §1 principle 4 is
 * explicit that we never claim what we cannot know. What it can say honestly is
 * which road you are on, which is what a guardian-facing safety app actually
 * needs on screen.
 *
 * Unnamed steps (alleys, footpaths, cut-throughs) are skipped rather than
 * rendered as a blank banner.
 *
 * Returns null when there is no route, no position, or no step worth naming.
 */
export function currentLeg(
  route: RouteResult | null,
  position: RouteCoordinate | null,
): RouteStep | null {
  if (!route || !position) return null;

  let nearest: RouteStep | null = null;
  let smallest = Infinity;

  for (const step of route.steps) {
    if (!step.name) continue;
    // Squared planar distance: this only ranks candidates against each other,
    // so the square root and the great-circle correction would change nothing
    // about which one wins.
    const dLat = step.start.latitude - position.latitude;
    const dLon = step.start.longitude - position.longitude;
    const d = dLat * dLat + dLon * dLon;
    if (d < smallest) {
      smallest = d;
      nearest = step;
    }
  }

  return nearest;
}
