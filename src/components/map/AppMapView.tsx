import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { useMapContext } from '../../context/MapContext';
import type { MapMarker, MapRegion, RoutePolyline } from '../../models/MapModels';

interface AppMapViewProps {
  region: MapRegion;
  markers: MapMarker[];
  polyline: RoutePolyline | null;
  style?: StyleProp<ViewStyle>;
}

/**
 * The single map component screens should use.
 * Reads the active MapProvider from context and delegates all rendering to it.
 * Screens never import a map SDK directly.
 */
export function AppMapView({ region, markers, polyline, style }: AppMapViewProps) {
  const { mapProvider } = useMapContext();
  const { MapView } = mapProvider;
  return <MapView region={region} markers={markers} polyline={polyline} style={style} />;
}
