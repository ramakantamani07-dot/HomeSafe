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

/**
 * A place someone is somewhere inside, rather than at — network location's
 * answer (spec §5: "a circle … never a dot"). Drawn as a filled circle so the
 * map itself says "approximate" before any label does.
 */
export interface MapArea {
  id: string;
  centre: Coordinates;
  radiusMeters: number;
}

/** Metres per degree of latitude — close enough for framing a camera. */
const METERS_PER_DEGREE = 111_000;

/** Room around the circle so its edge is visible, not flush with the screen. */
const AREA_FRAME_PADDING = 1.4;

/** A camera that shows the whole of an area, with its edge in view. */
export function regionForArea(area: MapArea): MapRegion {
  const delta = (area.radiusMeters * 2 * AREA_FRAME_PADDING) / METERS_PER_DEGREE;
  return {
    latitude: area.centre.latitude,
    longitude: area.centre.longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}
