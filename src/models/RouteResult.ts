/** A single point on a calculated route path. Same shape as Coordinates but semantically distinct. */
export interface RouteCoordinate {
  latitude: number;
  longitude: number;
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
  calculatedAt: Date;
}
