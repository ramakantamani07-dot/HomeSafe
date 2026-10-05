import type { Coordinates } from '../../models/Journey';
import { haversineMeters } from '../../models/Place';
import type { RouteCoordinate, RouteResult, RouteStep } from '../../models/RouteResult';
import type { RouteRequestOptions, RoutingProvider } from '../../providers/RoutingProvider';

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
    options: RouteRequestOptions = {},
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

    // Named after the fixture streets so the timeline reads plausibly in dev
    // rather than as "Step 1 / Step 2".
    const steps: RouteStep[] = options.includeSteps
      ? [
          {
            name: 'Mill Lane',
            distanceMeters: distanceMeters * 0.2,
            durationSeconds: durationSeconds * 0.2,
            start: coordinates[0],
          },
          {
            name: 'Glebe Road',
            distanceMeters: distanceMeters * 0.55,
            durationSeconds: durationSeconds * 0.55,
            start: coordinates[1],
          },
          {
            name: 'Harlestone Road',
            distanceMeters: distanceMeters * 0.25,
            durationSeconds: durationSeconds * 0.25,
            start: coordinates[3],
          },
        ]
      : [];

    return {
      providerRouteId: null,
      coordinates,
      distanceMeters,
      durationSeconds,
      steps,
      calculatedAt: new Date(),
    };
  }
}
