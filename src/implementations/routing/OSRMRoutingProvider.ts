import type { Coordinates } from '../../models/Journey';
import type { RouteCoordinate, RouteResult } from '../../models/RouteResult';
import type { RoutingProvider } from '../../providers/RoutingProvider';

// OSRM GeoJSON geometry uses [lng, lat] pairs
type OsrmGeometry = { coordinates: [number, number][] };

type OsrmRoute = {
  distance: number;
  duration: number;
  geometry: OsrmGeometry;
};

type OsrmResponse = {
  code: string;
  routes: OsrmRoute[];
};

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
  ): Promise<RouteResult> {
    // OSRM expects lng,lat order
    const path = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
    const url = `${this.baseUrl}/route/v1/driving/${path}?overview=full&geometries=geojson`;

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
      calculatedAt: new Date(),
    };
  }
}
