import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { useMapContext } from '../../context/MapContext';
import type { MapMarker, MapRegion, RoutePolyline } from '../../models/MapModels';

interface AppMapViewProps {
  region: MapRegion;
  markers: MapMarker[];
  polyline: RoutePolyline | null;
  style?: StyleProp<ViewStyle>;
  /** Allows pan/zoom — used by the map picker. */
  interactive?: boolean;
  /** Fires when an interactive map settles; its centre is the dropped pin. */
  onRegionChangeComplete?(region: MapRegion): void;
}

/**
 * The single map component screens should use.
 * Reads the active MapProvider from context and delegates all rendering to it.
 * Screens never import a map SDK directly.
 */
export function AppMapView({
  region,
  markers,
  polyline,
  style,
  interactive,
  onRegionChangeComplete,
}: AppMapViewProps) {
  const { mapProvider } = useMapContext();
  const { MapView } = mapProvider;
  return (
    <MapView
      region={region}
      markers={markers}
      polyline={polyline}
      style={style}
      interactive={interactive}
      onRegionChangeComplete={onRegionChangeComplete}
    />
  );
}
