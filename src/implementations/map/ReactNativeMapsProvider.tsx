import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Circle, Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '../../context/ThemeContext';
import { FEATURE_COLORS } from '../../config/theme';
import type { MarkerRole } from '../../models/MapModels';
import type { AppMapViewProps, MapProvider } from '../../providers/MapProvider';

/**
 * PROVIDER_DEFAULT resolves to Apple Maps on iOS (free, no key) and Google
 * Maps on Android (the only option there — needs android.config.googleMaps
 * .apiKey in app.config.ts, unset until a Google Cloud project exists; the
 * map renders as a blank grid on Android until then, not a crash).
 */
function ReactNativeMapView({
  region,
  markers,
  polyline,
  areas = [],
  style,
  interactive = false,
  onRegionChangeComplete,
}: AppMapViewProps) {
  const theme = useTheme();
  const mapRef = useRef<MapView>(null);
  // With Reduce Motion on, the camera jumps to a new fix instead of gliding.
  const reduceMotion = useReducedMotion();

  /**
   * "Follow until touched."
   *
   * An interactive map takes `region` as its *initial* camera only, so a fix
   * that lands after mount — the normal case, since GPS takes a moment — would
   * otherwise strand the camera on the fallback region forever. Driving the
   * camera imperatively recentres it when the fix arrives without handing the
   * controlled `region` prop back the power to snap the camera mid-gesture.
   *
   * Once the user pans, the camera is theirs: `userHasPanned` latches and the
   * map never steals it back. That is the difference between a map that helps
   * and one that fights you.
   */
  const userHasPanned = useRef(false);

  useEffect(() => {
    if (!interactive || userHasPanned.current) return;
    mapRef.current?.animateToRegion(region, reduceMotion ? 0 : CAMERA_SETTLE_MS);
    // Keyed on the coordinates rather than the object: callers rebuild the
    // region literal every render, which would otherwise re-animate constantly.
  }, [interactive, reduceMotion, region.latitude, region.longitude, region.latitudeDelta, region.longitudeDelta]);

  const roleColor: Record<MarkerRole, string> = {
    start: theme.accent,
    current: theme.safe.fg,
    destination: theme.critical.fg,
  };

  return (
    <MapView
      ref={mapRef}
      style={[StyleSheet.absoluteFillObject, style]}
      provider={PROVIDER_DEFAULT}
      onPanDrag={() => {
        userHasPanned.current = true;
      }}
      // An interactive map takes `region` as its starting camera only
      // (initialRegion) — passing the controlled `region` prop as well would
      // snap the camera back on every parent re-render, fighting the pan
      // gesture the picker depends on.
      {...(interactive ? { initialRegion: region } : { region })}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      rotateEnabled={false}
      pitchEnabled={false}
      onRegionChangeComplete={onRegionChangeComplete}
      // The app already renders its own "current location" marker fed by
      // tracked position (see useJourneyMap) — the native blue dot would be
      // redundant and could disagree with it.
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
    >
      {markers.map((m) => (
        <Marker key={m.id} coordinate={m.coordinate} title={m.title} pinColor={roleColor[m.role]} />
      ))}
      {polyline && (
        <Polyline coordinates={polyline.coordinates} strokeColor={theme.accent} strokeWidth={4} />
      )}
      {areas.map((a) => (
        <Circle
          key={a.id}
          center={a.centre}
          radius={a.radiusMeters}
          fillColor={FEATURE_COLORS.basicPhoneArea}
          strokeColor={FEATURE_COLORS.basicPhone}
          strokeWidth={2}
        />
      ))}
    </MapView>
  );
}

/** How long the camera takes to settle when recentring on a new fix. */
const CAMERA_SETTLE_MS = 350;

export class ReactNativeMapsProvider implements MapProvider {
  MapView = ReactNativeMapView;
}
