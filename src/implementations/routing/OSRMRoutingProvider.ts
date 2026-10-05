import type { Coordinates } from '../../models/Journey';
import type { RouteCoordinate, RouteResult, RouteStep } from '../../models/RouteResult';
import type { RouteRequestOptions, RoutingProvider } from '../../providers/RoutingProvider';

// OSRM GeoJSON geometry uses [lng, lat] pairs
type OsrmGeometry = { coordinates: [number, number][] };

type OsrmStep = {
  distance: number;
  duration: number;
  name: string;
  geometry?: OsrmGeometry;
};

type OsrmLeg = {
  steps?: OsrmStep[];
};

type OsrmRoute = {
  distance: number;
  duration: number;
  geometry: OsrmGeometry;
  legs?: OsrmLeg[];
};

type OsrmResponse = {
  code: string;
  routes: OsrmRoute[];
};

/**
 * Flattens OSRM's legs → steps into our trimmed RouteStep list.
 *
 * Unnamed steps keep a null name rather than a placeholder: the timeline would
 * rather show one fewer row than a line reading "Unnamed road", and the UI
 * filters on exactly that.
 */
function toSteps(route: OsrmRoute): RouteStep[] {
  const steps: RouteStep[] = [];
  for (const leg of route.legs ?? []) {
    for (const step of leg.steps ?? []) {
      const first = step.geometry?.coordinates?.[0];
      steps.push({
        name: step.name?.trim() ? step.name.trim() : null,
        distanceMeters: step.distance,
        durationSeconds: step.duration,
        start: first
          ? { latitude: first[1], longitude: first[0] }
          : { latitude: 0, longitude: 0 },
      });
    }
  }
  return steps;
}

/**
 * Calls the OSRM HTTP API to calculate a driving route.
 *
 * The base URL is injected at construction time so the provider is fully
 * swappable (self-hosted OSRM, public demo server, etc.) without any
 * code change. Only start and destination coordinates are sent — no personal
 * data leaves the app.
 *
 * OSRM coordinate order: longitude first, then latitude.
 */
export class OSRMRoutingProvider implements RoutingProvider {
  constructor(private readonly baseUrl: string) {}

  async getRoute(
    from: Coordinates,
    to: Coordinates,
    signal?: AbortSignal,
    options: RouteRequestOptions = {},
  ): Promise<RouteResult> {
    // OSRM expects lng,lat order
    const path = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
    // `steps` roughly triples the response, so it is only requested when the
    // caller actually renders a timeline — never on the live recalculation loop.
    const stepsParam = options.includeSteps ? '&steps=true' : '';
    const url =
      `${this.baseUrl}/route/v1/driving/${path}` +
      `?overview=full&geometries=geojson${stepsParam}`;

    const res = await fetch(url, { signal });

    if (!res.ok) {
      throw new Error(`OSRM returned HTTP ${res.status}`);
    }

    const json = (await res.json()) as OsrmResponse;

    if (json.code !== 'Ok' || json.routes.length === 0) {
      throw new Error(`OSRM: no route found (code=${json.code})`);
    }

    const route = json.routes[0];

    // Convert OSRM [lng, lat] pairs back to {latitude, longitude}
    const coordinates: RouteCoordinate[] = route.geometry.coordinates.map(
      ([lng, lat]) => ({ latitude: lat, longitude: lng }),
    );

    return {
      providerRouteId: null, // OSRM does not return route identifiers
      coordinates,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      steps: toSteps(route),
      calculatedAt: new Date(),
    };
  }
}
