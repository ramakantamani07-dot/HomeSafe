import type { Coordinates } from '../models/Journey';
import type { RouteResult } from '../models/RouteResult';

/**
 * Abstraction over any routing API.
 *
 * Concrete implementations:
 *  - OSRMRoutingProvider      — OSRM HTTP API (open-source, configurable base URL)
 *  - MockRoutingProvider      — deterministic synthetic route (dev / CI)
 *
 * Rules:
 *  - Only `from` and `to` coordinates are sent to the provider; no user IDs,
 *    phone numbers, or personal data.
 *  - The base URL and any API keys are injected at construction time, not
 *    hardcoded, so the provider remains swappable.
 */
export interface RoutingProvider {
  /**
   * Returns the best route between `from` and `to`.
   * Must respect the AbortSignal if supplied: throw an error with
   * `name === 'AbortError'` when the signal fires.
   */
  getRoute(
    from: Coordinates,
    to: Coordinates,
    signal?: AbortSignal,
  ): Promise<RouteResult>;
}
