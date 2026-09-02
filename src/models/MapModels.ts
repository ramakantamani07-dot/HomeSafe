import type { Coordinates } from './Journey';

export interface MapRegion {
  latitude: number;
  longitude: number;
  /** Degrees of latitude visible in the map viewport. */
  latitudeDelta: number;
  /** Degrees of longitude visible in the map viewport. */
  longitudeDelta: number;
}

/**
 * Semantic role of a pin on the map.
 * Drives colour in every concrete MapProvider implementation.
 */
export type MarkerRole = 'start' | 'current' | 'destination';

export interface MapMarker {
  id: string;
  coordinate: Coordinates;
  title: string;
  role: MarkerRole;
}

export interface RoutePolyline {
  /** Ordered waypoints forming the route path. */
  coordinates: Coordinates[];
}
