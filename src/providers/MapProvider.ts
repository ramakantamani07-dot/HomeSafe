import type React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import type { MapMarker, MapRegion, RoutePolyline } from '../models/MapModels';

export interface AppMapViewProps {
  region: MapRegion;
  markers: MapMarker[];
  /** Null when no route data exists (routing not yet implemented). */
  polyline: RoutePolyline | null;
  style?: StyleProp<ViewStyle>;
  /**
   * Lets the user pan/zoom.
   *
   * Off by default because journey screens drive the region themselves, and a
   * map that snaps the camera back to a computed region every tick is worse
   * than one that simply doesn't move.
   *
   * When on, `region` becomes the *initial* camera and the implementation
   * recentres imperatively instead — following until the user's first pan, then
   * leaving the camera alone. Home needs that: a map you cannot drag is not a
   * map, but a fix arriving after mount still has to bring the camera to you.
   */
  interactive?: boolean;
  /**
   * Fires once the user stops moving an interactive map. The map picker reads
   * the centre of this region as the dropped pin — a centre-crosshair picker
   * rather than a tap-to-place one, so the pin is always reachable with one
   * thumb.
   */
  onRegionChangeComplete?(region: MapRegion): void;
}

/**
 * Abstraction over any map SDK.
 *
 * Concrete implementations:
 *  - MockMapProvider      — pure React Native card, no native SDK (dev / CI)
 *  - ReactNativeMapsProvider — react-native-maps (Apple Maps / Google Maps)
 *  - MapLibreProvider     — MapLibre GL (offline-capable, open-source tiles)
 *
 * Switch by replacing the singleton supplied to MapStateProvider in AppProviders.
 */
export interface MapProvider {
  MapView: React.ComponentType<AppMapViewProps>;
}
