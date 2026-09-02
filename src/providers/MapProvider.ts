import type React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import type { MapMarker, MapRegion, RoutePolyline } from '../models/MapModels';

export interface AppMapViewProps {
  region: MapRegion;
  markers: MapMarker[];
  /** Null when no route data exists (routing not yet implemented). */
  polyline: RoutePolyline | null;
  style?: StyleProp<ViewStyle>;
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
