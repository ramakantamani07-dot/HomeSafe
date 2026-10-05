/**
 * Routing Tests
 *
 * Pure unit tests for RoutingService. No React rendering, no network calls.
 * Uses an in-memory SpyRoutingProvider to control responses and failures.
 */

import { RoutingService } from '../services/RoutingService';
import type { RoutingProvider } from '../providers/RoutingProvider';
import type { Coordinates } from '../models/Journey';
import type { RouteResult } from '../models/RouteResult';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FROM: Coordinates = { latitude: 51.5074, longitude: -0.1278 };
const TO: Coordinates = { latitude: 51.515, longitude: -0.1 };

function makeRoute(from: Coordinates, to: Coordinates, overrides: Partial<RouteResult> = {}): RouteResult {
  return {
    providerRouteId: null,
    coordinates: [
      { latitude: from.latitude, longitude: from.longitude },
      { latitude: (from.latitude + to.latitude) / 2, longitude: (from.longitude + to.longitude) / 2 },
      { latitude: to.latitude, longitude: to.longitude },
    ],
    distanceMeters: 2_500,
    durationSeconds: 360,
    steps: [],
    calculatedAt: new Date(),
    ...overrides,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Spy provider ─────────────────────────────────────────────────────────────

class SpyRoutingProvider implements RoutingProvider {
  callCount = 0;
  shouldFail = false;
  responseDelayMs = 0;
  lastSignal: AbortSignal | undefined = undefined;

  async getRoute(
    from: Coordinates,
    to: Coordinates,
    signal?: AbortSignal,
  ): Promise<RouteResult> {
    this.callCount++;
    this.lastSignal = signal;

    if (this.responseDelayMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, this.responseDelayMs);
        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    }

    if (signal?.aborted) {
      const err = new Error('Aborted');
      err.name = 'AbortError';
      throw err;
    }

    if (this.shouldFail) {
      throw new Error('Provider network error');
    }

    return makeRoute(from, to);
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RoutingService', () => {

  // 1. Successful route calculation
  test('returns a route result on success', async () => {
    const provider = new SpyRoutingProvider();
    const service = new RoutingService(provider);

    const result = await service.calculateRoute(FROM, TO);

    expect(result.coordinates.length).toBeGreaterThan(0);
    expect(result.distanceMeters).toBe(2_500);
    expect(result.durationSeconds).toBe(360);
    expect(result.calculatedAt).toBeInstanceOf(Date);
    expect(provider.callCount).toBe(1);
  });

  // 2. ETA formatting
  test('formats ETA, distance, and duration correctly', () => {
    const service = new RoutingService(new SpyRoutingProvider());
    const now = new Date('2026-07-10T14:00:00.000Z');

    expect(service.formatDuration(45)).toBe('Less than a minute');
    expect(service.formatDuration(360)).toBe('6 min');
    expect(service.formatDuration(3_660)).toBe('1 h 1 min');
    expect(service.formatDuration(7_200)).toBe('2 h');

    expect(service.formatDistance(450)).toBe('450 m');
    expect(service.formatDistance(2_500)).toBe('2.5 km');
    expect(service.formatDistance(12_340)).toBe('12.3 km');

    const eta = service.computeEta(3_600, now);
    expect(eta.getTime()).toBe(now.getTime() + 3_600_000);
  });

  // 3. Routing provider failure — journey continues
  test('throws when provider fails, leaving route null for callers', async () => {
    const provider = new SpyRoutingProvider();
    provider.shouldFail = true;
    const service = new RoutingService(provider);

    await expect(service.calculateRoute(FROM, TO)).rejects.toThrow('Provider network error');
    // Callers catch this and let the journey continue with route = null
  });

  // 4. Request timeout
  test('aborts the request when it exceeds timeoutMs', async () => {
    const provider = new SpyRoutingProvider();
    provider.responseDelayMs = 5_000; // much longer than the timeout
    const service = new RoutingService(provider, { timeoutMs: 50 });

    await expect(service.calculateRoute(FROM, TO)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(provider.callCount).toBe(1);
  });

  // 5. Stale-response handling
  test('aborts the first request when a second one starts before it completes', async () => {
    const provider = new SpyRoutingProvider();
    provider.responseDelayMs = 200;
    const service = new RoutingService(provider, { cacheTtlMs: 0 }); // disable cache

    const [r1, r2] = await Promise.allSettled([
      service.calculateRoute(FROM, TO),
      // Start second request while the first is still in flight
      (async () => {
        await delay(30);
        const TO2: Coordinates = { latitude: 51.52, longitude: -0.09 };
        return service.calculateRoute(FROM, TO2);
      })(),
    ]);

    // First request was aborted (either by signal or stale-seq check)
    expect(r1.status).toBe('rejected');
    expect((r1 as PromiseRejectedResult).reason.name).toBe('AbortError');

    // Second request succeeded
    expect(r2.status).toBe('fulfilled');
    expect(provider.callCount).toBe(2);
  });

  // 6. Route caching
  test('returns cached result without calling the provider again', async () => {
    const provider = new SpyRoutingProvider();
    const service = new RoutingService(provider, { cacheTtlMs: 60_000 });

    const r1 = await service.calculateRoute(FROM, TO);
    const r2 = await service.calculateRoute(FROM, TO);

    // Exact same object reference — served from cache
    expect(r1).toBe(r2);
    expect(provider.callCount).toBe(1);
  });

  // 7. Recalculation cooldown
  test('isOnCooldown returns false before any calculation and true immediately after', async () => {
    const provider = new SpyRoutingProvider();
    const service = new RoutingService(provider, { cooldownMs: 60_000 });

    expect(service.isOnCooldown()).toBe(false);

    await service.calculateRoute(FROM, TO);

    expect(service.isOnCooldown()).toBe(true);
  });

  test('cooldown expires after cooldownMs elapses', async () => {
    const provider = new SpyRoutingProvider();
    const service = new RoutingService(provider, { cooldownMs: 50 });

    await service.calculateRoute(FROM, TO);
    expect(service.isOnCooldown()).toBe(true);

    await delay(60);
    expect(service.isOnCooldown()).toBe(false);
  });

  // 8. Journey continuing without a route
  test('isOffRoute and isStale work independently of route availability', () => {
    const service = new RoutingService(new SpyRoutingProvider());

    // Empty route: never considered off-route
    const emptyRoute: RouteResult = makeRoute(FROM, TO, { coordinates: [] });
    expect(service.isOffRoute(FROM, emptyRoute)).toBe(false);

    // Route where the user IS on the route
    const onRouteRoute = makeRoute(FROM, TO);
    // FROM is one of the waypoints, so distance = 0 → not off-route
    expect(service.isOffRoute(FROM, onRouteRoute)).toBe(false);

    // Far-away position should be off-route
    const farAway: Coordinates = { latitude: 52.0, longitude: 1.0 };
    expect(service.isOffRoute(farAway, onRouteRoute)).toBe(true);

    // Stale: a route calculated a long time ago
    const staleRoute = makeRoute(FROM, TO, {
      calculatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    });
    expect(service.isStale(staleRoute)).toBe(true);

    // Fresh: just calculated
    const freshRoute = makeRoute(FROM, TO);
    expect(service.isStale(freshRoute)).toBe(false);
  });
});
