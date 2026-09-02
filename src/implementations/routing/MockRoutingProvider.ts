import type { Coordinates } from '../../models/Journey';
import type { RouteCoordinate, RouteResult } from '../../models/RouteResult';
import type { RoutingProvider } from '../../providers/RoutingProvider';

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

function lerp(a: Coordinates, b: Coordinates, t: number): RouteCoordinate {
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
  };
}

function abortError(): Error {
  const err = new Error('The operation was aborted');
  err.name = 'AbortError';
  return err;
}

/**
 * Returns a deterministic synthetic route for use in dev mode and CI.
 * No network calls are made — the route is a straight-line interpolation
 * with a realistic road-distance factor applied.
 */
export class MockRoutingProvider implements RoutingProvider {
  async getRoute(
    from: Coordinates,
    to: Coordinates,
    signal?: AbortSignal,
  ): Promise<RouteResult> {
    // Simulate a short async delay (realistic for dev feedback)
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 400);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(abortError());
      });
    });

    if (signal?.aborted) throw abortError();

    const straightLine = haversineMeters(from, to);
    // Apply a 1.35× road-distance factor (roads are never perfectly straight)
    const distanceMeters = straightLine * 1.35;
    // Assume ~40 km/h average speed (90 s per km)
    const durationSeconds = Math.round((distanceMeters / 1_000) * 90);

    // 5-point polyline: straight-line interpolation between start and destination
    const coordinates: RouteCoordinate[] = [
      { latitude: from.latitude, longitude: from.longitude },
      lerp(from, to, 0.25),
      lerp(from, to, 0.5),
      lerp(from, to, 0.75),
      { latitude: to.latitude, longitude: to.longitude },
    ];

    return {
      providerRouteId: null,
      coordinates,
      distanceMeters,
      durationSeconds,
      calculatedAt: new Date(),
    };
  }
}
