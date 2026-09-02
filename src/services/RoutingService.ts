import type { Coordinates } from '../models/Journey';
import type { RouteResult } from '../models/RouteResult';
import type { RoutingProvider } from '../providers/RoutingProvider';

// ─── Haversine helper ─────────────────────────────────────────────────────────

function haversineMeters(a: Coordinates, b: Coordinates): number {
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
    this.cooldownMs = options.cooldownMs ?? 60_000;
    this.cacheTtlMs = options.cacheTtlMs ?? 300_000;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.staleMs = options.staleMs ?? 30 * 60_000;
    this.offRouteMeters = options.offRouteMeters ?? 250;
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
  async calculateRoute(from: Coordinates, to: Coordinates): Promise<RouteResult> {
    const key = routeCacheKey(from, to);
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
      const result = await this.provider.getRoute(from, to, controller.signal);

      // A newer calculateRoute call started while we were waiting — discard this result
      if (this.requestSeq !== seq) {
        const err = new Error('Stale route response discarded');
        err.name = 'AbortError';
        throw err;
      }

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
  isOffRoute(current: Coordinates, route: RouteResult): boolean {
    if (route.coordinates.length === 0) return false;
    const minDist = route.coordinates.reduce(
      (min, coord) => Math.min(min, haversineMeters(current, coord)),
      Infinity,
    );
    return minDist > this.offRouteMeters;
  }

  // ─── Formatting ───────────────────────────────────────────────────────────

  /** Returns a Date representing when the user will arrive based on current time. */
  computeEta(durationSeconds: number, fromTime?: Date): Date {
    const base = fromTime ?? new Date();
    return new Date(base.getTime() + durationSeconds * 1_000);
  }

  /** "23 min", "1 h 5 min", "Less than a minute" */
  formatDuration(seconds: number): string {
    if (seconds < 60) return 'Less than a minute';
    const h = Math.floor(seconds / 3_600);
    const m = Math.floor((seconds % 3_600) / 60);
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} h`;
    return `${h} h ${m} min`;
  }

  /** "450 m", "1.2 km" */
  formatDistance(meters: number): string {
    if (meters < 1_000) return `${Math.round(meters)} m`;
    return `${(meters / 1_000).toFixed(1)} km`;
  }

  /** "14:35" */
  formatEta(eta: Date): string {
    return eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
