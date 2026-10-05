import React, { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { ELEVATION, FONTS, RADIUS, SPACING, type ThemeColors } from '../../src/config/theme';
import { useJourneyDraft } from '../../src/context/JourneyDraftContext';
import { usePlaces } from '../../src/hooks/usePlaces';
import { useActiveJourneyLocation } from '../../src/hooks/useActiveJourneyLocation';
import { AppMapView } from '../../src/components/map/AppMapView';
import { Button } from '../../src/components/ui/Button';
import { Icon } from '../../src/components/ui/Icon';
import type { Coordinates } from '../../src/models/Journey';
import type { MapRegion } from '../../src/models/MapModels';

/** Central London — only used before the first location fix arrives. */
const FALLBACK_REGION: MapRegion = {
  latitude: 51.5074,
  longitude: -0.1278,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

/**
 * "Choose on map instead" — a centre-crosshair picker.
 *
 * The pin stays fixed in the middle of the screen while the map moves under
 * it, so placing it never requires a second hand or an awkward long-press,
 * and the target is always in reach of a thumb. Confirming reverse-geocodes
 * the centre into a proper Place, because JOURNEY_FLOW_SPEC §3 requires every
 * destination to carry a name and address, not just coordinates.
 *
 * `mode=place` returns the pin to screen 03 to be named and saved; the
 * default sends it straight to review (04) as a one-off destination.
 */
export default function MapPickerScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { placesService } = usePlaces();
  const { setDestination, setPendingPin } = useJourneyDraft();
  const { currentLocation } = useActiveJourneyLocation();

  const initialRegion: MapRegion = currentLocation
    ? {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      }
    : FALLBACK_REGION;

  // The centre is read on confirm, not rendered, so a ref avoids re-rendering
  // the map on every frame of a pan gesture.
  const centreRef = useRef<Coordinates>({
    latitude: initialRegion.latitude,
    longitude: initialRegion.longitude,
  });

  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setResolving(true);
    setError(null);
    const centre = centreRef.current;

    if (mode === 'place') {
      // Screen 03 owns naming and saving — hand it the raw coordinates and
      // let it do the lookup, so there's one place that turns a pin into a
      // saved place. Going back (rather than replacing the route) keeps the
      // screen that opened the picker exactly where it was.
      setPendingPin(centre);
      router.back();
      return;
    }

    try {
      const place = await placesService.describeCoordinates(centre);
      setDestination(place, { origin: 'where-to' });
      router.replace('/(app)/review-journey');
    } catch {
      setError("We couldn't identify that spot. Move the map slightly and try again.");
      setResolving(false);
    }
  };

  return (
    <View style={styles.root}>
      <AppMapView
        region={initialRegion}
        markers={[]}
        polyline={null}
        interactive
        onRegionChangeComplete={(region) => {
          centreRef.current = { latitude: region.latitude, longitude: region.longitude };
        }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Fixed centre crosshair — pointerEvents none so it never eats a pan. */}
      <View style={styles.crosshairWrap} pointerEvents="none">
        <Icon name="location" size={40} color={theme.textPrimary} />
        <View style={styles.crosshairDot} />
      </View>

      <View style={[styles.header, { top: insets.top + SPACING.sm }]} pointerEvents="box-none">
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backChip}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Icon name="chevronLeft" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.hintPill}>
          <Text style={styles.hintText}>Move the map to place the pin</Text>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.lg }]}>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <Button
          label={resolving ? 'Finding address…' : 'Use this location'}
          variant="strong"
          onPress={handleConfirm}
          loading={resolving}
        />
      </View>

      {resolving && (
        <View style={styles.blockingOverlay} pointerEvents="auto">
          <ActivityIndicator color={theme.accent} />
        </View>
      )}
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    crosshairWrap: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      // Lifts the glyph so its *point* sits on the map centre rather than
      // its bounding-box centre.
      paddingBottom: 40,
    },
    crosshairDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.textPrimary,
      opacity: 0.4,
      marginTop: 4,
    },
    header: {
      position: 'absolute',
      left: SPACING.lg,
      right: SPACING.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    backChip: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      ...ELEVATION.float,
    },
    hintPill: {
      flex: 1,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.pill,
      backgroundColor: theme.surface,
      ...ELEVATION.float,
    },
    hintText: {
      fontSize: 14,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
      textAlign: 'center',
    },
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.lg,
      gap: SPACING.md,
      backgroundColor: theme.background,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
    },
    errorText: {
      fontSize: 14,
      fontFamily: FONTS.body,
      color: theme.critical.fg,
      textAlign: 'center',
    },
    blockingOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.08)',
    },
  });
}
