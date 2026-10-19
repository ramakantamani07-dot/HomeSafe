import type { Coordinates } from '../models/Journey';
import type { RouteResult } from '../models/RouteResult';
import {
  computeEta,
  formatDistance,
  formatDuration,
  formatEta,
} from '../models/RouteResult';
import { haversineMeters, type TravelMode } from '../models/Place';
import {
  WALKING_SPEED_MPS,
  derivedSpeedMps,
  routingProfile,
  type RoutingProfile,
} from '../models/TravelModeProfile';
import type { RouteRequestOptions, RoutingProvider } from '../providers/RoutingProvider';

/*
 * Which route to fetch and how its time is read for each mode lives in
 * models/TravelModeProfile.ts. The rule here: trust the router's time only
 * when it served the kind of route asked for. MapKit serves both walking and
 * driving; OSRM's demo serves driving only, so a walk planned with it has its
 * time derived from distance. (Before 19 Oct this assumed every router returned
 * a driving time — after MapKit walking routes, "Car" showed walking ETAs.)
 */

// ─── Cache key ────────────────────────────────────────────────────────────────

// Round to 4 decimal places (~11 m precision) so minor GPS jitter does not
// cause cache misses on routes between the same two points.
function routeCacheKey(from: Coordinates, to: Coordinates): string {
  return (
    `${from.latitude.toFixed(4)},${from.longitude.toFixed(4)}` +
    `|${to.latitude.toFixed(4)},${to.longitude.toFixed(4)}`
  );
}

// ─── Options ─────────────────────────────────────────────────────────────────

export interface RoutingServiceOptions {
  /** Minimum ms between automatic recalculations (e.g. off-route). Default: 60 s. */
  cooldownMs?: number;
  /** How long a cached result is considered fresh. Default: 5 min. */
  cacheTtlMs?: number;
  /** AbortController fires after this many ms if the provider hasn't responded. Default: 15 s. */
  timeoutMs?: number;
  /** A route older than this is considered stale and eligible for recalculation. Default: 30 min. */
  staleMs?: number;
  /** Distance in metres from the nearest route point before the user is "off route". Default: 250 m. */
  offRouteMeters?: number;
}

/**
 * Defaults, named rather than inline.
 *
 * Every one of these is a battery or cost decision, not an arbitrary number:
 * the cooldown and cache bound how often a journey hits the routing API, and
 * the off-route threshold decides how often a recalculation is triggered at
 * all. Naming them keeps that visible at the point someone is tempted to
 * shrink one.
 */
export const ROUTING_DEFAULTS = {
  /** Minimum gap between automatic recalculations. */
  cooldownMs: 60_000,
  /** How long a cached route stays fresh — also what makes Home's per-place ETA chips cheap. */
  cacheTtlMs: 5 * 60_000,
  /** Give up on a slow provider rather than holding the request open. */
  timeoutMs: 15_000,
  /** A route older than this is recalculated on the next opportunity. */
  staleMs: 30 * 60_000,
  /** Metres from the nearest route point before the traveller counts as off it. */
  offRouteMeters: 250,
} as const;

// ─── Service ─────────────────────────────────────────────────────────────────

export class RoutingService {
  private readonly cooldownMs: number;
  private readonly cacheTtlMs: number;
  private readonly timeoutMs: number;
  private readonly staleMs: number;
  private readonly offRouteMeters: number;

  private requestSeq = 0;
  private lastCalcAt: number | null = null;
  private cache = new Map<string, { result: RouteResult; cachedAt: number }>();
  private activeController: AbortController | null = null;

  constructor(
    private readonly provider: RoutingProvider,
    options: RoutingServiceOptions = {},
  ) {
    this.cooldownMs = options.cooldownMs ?? ROUTING_DEFAULTS.cooldownMs;
    this.cacheTtlMs = options.cacheTtlMs ?? ROUTING_DEFAULTS.cacheTtlMs;
    this.timeoutMs = options.timeoutMs ?? ROUTING_DEFAULTS.timeoutMs;
    this.staleMs = options.staleMs ?? ROUTING_DEFAULTS.staleMs;
    this.offRouteMeters = options.offRouteMeters ?? ROUTING_DEFAULTS.offRouteMeters;
  }

  /**
   * Calculates a route between `from` and `to`.
   *
   * - Returns a cached result if the same request was made within `cacheTtlMs`.
   * - Aborts any in-flight request before starting a new one (stale-response guard).
   * - Throws with `name === 'AbortError'` if the provider is too slow (`timeoutMs`).
   * - Throws if the provider returns an error; callers must handle this gracefully
   *   (journey continues without route data).
   */
  async calculateRoute(
    from: Coordinates,
    to: Coordinates,
    mode: TravelMode = 'car',
  ): Promise<RouteResult> {
    const key = `${routeCacheKey(from, to)}|${mode}`;
    const cached = this.cache.get(key);
    if (cached !== undefined && Date.now() - cached.cachedAt < this.cacheTtlMs) {
      return cached.result;
    }

    // Abort any previous in-flight request so its result is discarded
    this.activeController?.abort();
    const controller = new AbortController();
    this.activeController = controller;
    const seq = ++this.requestSeq;

    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const profile = routingProfile(mode);
      const raw = await this.provider.getRoute(from, to, controller.signal, { profile });

      // A newer calculateRoute call started while we were waiting — discard this result
      if (this.requestSeq !== seq) {
        const err = new Error('Stale route response discarded');
        err.name = 'AbortError';
        throw err;
      }

      const result = this.applyTravelMode(raw, mode, profile);
      this.cache.set(key, { result, cachedAt: Date.now() });
      this.lastCalcAt = Date.now();
      return result;
    } finally {
      clearTimeout(timeoutId);
      if (this.activeController === controller) {
        this.activeController = null;
      }
    }
  }

  /**
   * A one-off route for screen 04's preview, calculated before any journey
   * exists. Deliberately separate from calculateRoute: the preview must not
   * abort — or be aborted by — the live journey's recalculation loop, and it
   * must not reset the cooldown that throttles that loop.
   */
  async previewRoute(
    from: Coordinates,
    to: Coordinates,
    mode: TravelMode,
    signal?: AbortSignal,
    options: RouteRequestOptions = {},
  ): Promise<RouteResult> {
    // Steps are part of the cache identity: a cached stepless route must not
    // satisfy a caller that needs a timeline.
    const key = `${routeCacheKey(from, to)}|${mode}|${options.includeSteps ? 'steps' : 'nosteps'}`;
    const cached = this.cache.get(key);
    if (cached !== undefined && Date.now() - cached.cachedAt < this.cacheTtlMs) {
      return cached.result;
    }

    const profile = routingProfile(mode);
    const raw = await this.provider.getRoute(from, to, signal, { ...options, profile });
    const result = this.applyTravelMode(raw, mode, profile);
    this.cache.set(key, { result, cachedAt: Date.now() });
    return result;
  }

  /**
   * The mode's travel time. Bike and bus are derived from distance (no free
   * router knows them); otherwise the router's own time when it served the
   * profile asked for, and a walking pace over its distance when it did not.
   * Distance and geometry are never rewritten — that would be inventing data.
   */
  private applyTravelMode(route: RouteResult, mode: TravelMode, asked: RoutingProfile): RouteResult {
    const derived = derivedSpeedMps(mode);
    if (derived !== null) {
      return { ...route, durationSeconds: Math.round(route.distanceMeters / derived) };
    }
    if (this.provider.profilesSupported.includes(asked)) return route;
    if (asked === 'walking') {
      return { ...route, durationSeconds: Math.round(route.distanceMeters / WALKING_SPEED_MPS) };
    }
    return route;
  }

  /** Abort the in-flight request, if any. Call when the journey ends. */
  cancelPendingRequest(): void {
    this.activeController?.abort();
    this.activeController = null;
    this.requestSeq++;
  }

  // ─── Recalculation guards ──────────────────────────────────────────────────

  /** True while within the cooldown window after the last successful calculation. */
  isOnCooldown(): boolean {
    return (
      this.lastCalcAt !== null &&
      Date.now() - this.lastCalcAt < this.cooldownMs
    );
  }

  /** True when the route was calculated more than `staleMs` ago. */
  isStale(route: RouteResult): boolean {
    return Date.now() - route.calculatedAt.getTime() > this.staleMs;
  }

  /**
   * True when the nearest route waypoint is more than `offRouteMeters` away
   * from `current`. Returns false for empty routes (no waypoints to be off of).
   */
  isOffRoute(current: Coordinates, route: RouteResult, thresholdMeters = this.offRouteMeters): boolean {
    if (route.coordinates.length === 0) return false;
    const minDist = route.coordinates.reduce(
      (min, coord) => Math.min(min, haversineMeters(current, coord)),
      Infinity,
    );
    return minDist > thresholdMeters;
  }

  // ─── Formatting ───────────────────────────────────────────────────────────

  /** @see computeEta in models/RouteResult — kept here for callers holding a service. */
  computeEta(durationSeconds: number, fromTime?: Date): Date {
    return computeEta(durationSeconds, fromTime);
  }

  /** @see formatDuration in models/RouteResult. */
  formatDuration(seconds: number): string {
    return formatDuration(seconds);
  }

  /** @see formatDistance in models/RouteResult. */
  formatDistance(meters: number): string {
    return formatDistance(meters);
  }

  /** @see formatEta in models/RouteResult. */
  formatEta(eta: Date): string {
    return formatEta(eta);
  }
}
