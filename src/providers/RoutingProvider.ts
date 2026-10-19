import type { Coordinates } from '../models/Journey';
import type { RouteResult } from '../models/RouteResult';
import type { RoutingProfile } from '../models/TravelModeProfile';

/**
 * Abstraction over any routing API.
 *
 * Concrete implementations:
 *  - MapKitWalkingRoutingProvider — Apple MapKit walking routes (iOS; free, keyless)
 *  - OSRMRoutingProvider      — OSRM HTTP API (open-source, configurable base URL);
 *                               Android until a walking source replaces it
 *  - MockRoutingProvider      — deterministic synthetic route (dev / CI)
 *
 * Rules:
 *  - Only `from` and `to` coordinates are sent to the provider; no user IDs,
 *    phone numbers, or personal data.
 *  - The base URL and any API keys are injected at construction time, not
 *    hardcoded, so the provider remains swappable.
 */
export interface RouteRequestOptions {
  /**
   * Ask the provider for per-leg steps, for the journey timeline on screen 03.
   *
   * Off by default because it makes the response substantially larger, and the
   * live-journey recalculation loop — which runs repeatedly while travelling —
   * has no use for them.
   */
  includeSteps?: boolean;
  /**
   * Walking or road route. A provider that cannot serve the profile asked for
   * returns its own and says so in `profilesSupported`; the service then
   * derives the time from distance instead of trusting it.
   */
  profile?: RoutingProfile;
}

export interface RoutingProvider {
  /** The route kinds this provider really computes (OSRM's demo: driving only). */
  readonly profilesSupported: readonly RoutingProfile[];

  /**
   * Returns the best route between `from` and `to`.
   * Must respect the AbortSignal if supplied: throw an error with
   * `name === 'AbortError'` when the signal fires.
   */
  getRoute(
    from: Coordinates,
    to: Coordinates,
    signal?: AbortSignal,
    options?: RouteRequestOptions,
  ): Promise<RouteResult>;
}
