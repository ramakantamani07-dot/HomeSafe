import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { FEATURE_COLORS, FONTS, RADIUS, SPACING, type ThemeColors } from '../../src/config/theme';
import { useFamily } from '../../src/hooks/useFamily';
import { useFakeCall } from '../../src/hooks/useFakeCall';
import { useJourney } from '../../src/hooks/useJourney';
import { useActiveJourneyLocation } from '../../src/hooks/useActiveJourneyLocation';
import { TOLD_CIRCLE_CONFIRMATION } from '../../src/models/UneasyEvent';
import { useSafePlaces } from '../../src/hooks/useSafePlaces';
import { haptics } from '../../src/utils/haptics';
import { callNumber, openDirections } from '../../src/utils/deviceLinks';
import { SAFE_PLACE_LABELS } from '../../src/models/SafePlace';
import { formatDistance } from '../../src/models/RouteResult';
import { Icon, type IconName } from '../../src/components/ui/Icon';
import { SOSHoldBar } from '../../src/components/journey/SOSHoldBar';

/**
 * "Feeling uneasy?" (Option 15 `AI5`), reached from the pill on `AI4`.
 *
 * The screen's whole job is to be the step *before* an emergency. Someone who
 * is uncomfortable but not in danger should not have to decide whether their
 * situation "counts" as an SOS — so the journey keeps running, nothing is sent
 * to guardians by default, and the subtitle says so.
 *
 * **Partial, deliberately.** The spec lists four tiles; the two built here are
 * the ones the app can already do honestly. "Nearest open" needs a
 * point-of-interest search (MKLocalSearch via a native module — Apple exposes
 * no opening hours, so it will be limited to inherently 24/7 categories), and
 * "Tell my circle" needs a non-emergency alert type and the `UneasyEvent` log.
 * Both are Phase 4. A tile that silently does nothing would be worse here than
 * on any other screen in the app, so they are absent rather than inert.
 */
export default function UneasyScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { members } = useFamily();
  const { startFakeCall } = useFakeCall();
  const { logUneasyEvent } = useJourney();
  const { currentLocation, startUneasyBoost } = useActiveJourneyLocation();
  const { places, isSearching, isEmpty, find } = useSafePlaces();

  const [toldCircle, setToldCircle] = useState(false);

  // Opening this screen is itself a signal worth keeping: someone who looks
  // for help and then closes the screen is a pattern the route-safety work
  // needs to see, and it is invisible if only the chosen action is logged.
  useEffect(() => {
    if (currentLocation) void find(currentLocation);
  }, [currentLocation, find]);

  useEffect(() => {
    logUneasyEvent('opened', currentLocation);
    // Once per visit — currentLocation changing is not a new uneasy moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const firstGuardian = members.length > 0 ? members[0] : null;

  const callGuardian = () => {
    if (!firstGuardian) return;
    logUneasyEvent('called-guardian', currentLocation);
    callNumber(firstGuardian.phoneNumber);
  };

  /**
   * "Tell my circle" — explicitly *not* an emergency.
   *
   * Raises the location update rate for 15 minutes so guardians watching see
   * movement in close to real time, and records the choice. The boost is owned
   * by the tracking service, so leaving this screen does not cancel it and
   * forgetting about it does not strand it on.
   */
  /**
   * Directions, deliberately not a journey reroute — they may want the police
   * station *and* still be expected home (see `openDirections`).
   */
  const openInMaps = openDirections;

  const tellMyCircle = () => {
    logUneasyEvent('told-circle', currentLocation);
    startUneasyBoost();
    haptics.nonEmergencySent();
    setToldCircle(true);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + SPACING.xl }]}>
      <Text style={styles.title}>We're right here.</Text>
      <Text style={styles.subtitle}>Your walk keeps going.</Text>

      <View style={styles.tiles}>
        {firstGuardian && (
          <Tile
            styles={styles}
            icon="call"
            tint={theme.accent}
            label={`Call ${firstGuardian.displayName}`}
            hint="Rings them now"
            onPress={callGuardian}
          />
        )}
        <Tile
          styles={styles}
          icon="call"
          tint={FEATURE_COLORS.fakeCall}
          label="Fake call"
          hint="A way to leave without explaining"
          onPress={() => {
            logUneasyEvent('fake-call', currentLocation);
            startFakeCall();
            router.push('/(app)/fake-incoming-call');
          }}
        />
        <Tile
          styles={styles}
          icon="eye"
          tint={theme.accent}
          label={toldCircle ? 'Circle told' : 'Tell my circle'}
          hint={toldCircle ? 'Live location for 15 min' : 'Not an emergency'}
          onPress={tellMyCircle}
        />
      </View>


      {/*
        Nearest places to head for.
        Headed "Open around the clock", never "open now": no keyless source
        publishes opening hours, so these are places that are staffed by their
        nature rather than places we have checked. See models/SafePlace.ts.
      */}
      {(places.length > 0 || isSearching || isEmpty) && (
        <View style={styles.nearby}>
          <Text style={styles.nearbyHeading}>Open around the clock</Text>
          {isSearching && <Text style={styles.nearbyHint}>Looking nearby…</Text>}
          {isEmpty && <Text style={styles.nearbyHint}>Nothing found within walking distance.</Text>}
          {places.slice(0, 3).map((place) => (
            <Pressable
              key={place.id}
              onPress={() => openInMaps(place.coordinates.latitude, place.coordinates.longitude, place.name)}
              style={({ pressed }) => [styles.nearbyRow, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${place.name}, ${SAFE_PLACE_LABELS[place.kind]}, ${formatDistance(place.distanceMeters)} away. Opens directions.`}
            >
              <View style={styles.nearbyText}>
                <Text style={styles.nearbyName} numberOfLines={1}>{place.name}</Text>
                <Text style={styles.nearbyMeta} numberOfLines={1}>
                  {SAFE_PLACE_LABELS[place.kind]} · {formatDistance(place.distanceMeters)}
                </Text>
              </View>
              <Icon name="chevronRight" size={18} color={theme.textSecondary} />
            </Pressable>
          ))}
        </View>
      )}

      {toldCircle && (
        <Text style={styles.confirmation}>{TOLD_CIRCLE_CONFIRMATION}</Text>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.lg }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.fine, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="I'm fine now. Go back to your journey."
        >
          <Text style={styles.fineLabel}>I'm fine now</Text>
        </Pressable>

        <SOSHoldBar />
      </View>
    </View>
  );
}

function Tile({
  styles,
  icon,
  tint,
  label,
  hint,
  onPress,
}: {
  styles: ReturnType<typeof getStyles>;
  icon: IconName;
  tint: string;
  label: string;
  hint: string;
  onPress(): void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${hint}`}
    >
      <View style={[styles.tileIcon, { backgroundColor: `${tint}1A` }]}>
        <Icon name={icon} size={24} color={tint} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileHint}>{hint}</Text>
    </Pressable>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.background,
      paddingHorizontal: SPACING.lg,
    },
    title: {
      fontSize: 30,
      fontFamily: FONTS.headingXBold,
      color: theme.textPrimary,
      letterSpacing: -0.6,
    },
    subtitle: {
      marginTop: SPACING.xs,
      fontSize: 16,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    tiles: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.md,
      marginTop: SPACING.xl,
    },
    tile: {
      flexGrow: 1,
      flexBasis: '45%',
      padding: SPACING.lg,
      borderRadius: RADIUS.lg,
      backgroundColor: theme.surface,
    },
    tileIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
    },
    tileLabel: {
      fontSize: 16,
      fontFamily: FONTS.heading,
      color: theme.textPrimary,
    },
    tileHint: {
      marginTop: 2,
      fontSize: 13,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    pressed: {
      opacity: 0.85,
    },
    nearby: {
      marginTop: SPACING.xl,
    },
    nearbyHeading: {
      fontSize: 13,
      fontFamily: FONTS.heading,
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: SPACING.sm,
    },
    nearbyHint: {
      fontSize: 14,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
      paddingVertical: SPACING.sm,
    },
    nearbyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.lg,
      backgroundColor: theme.surface,
      marginBottom: SPACING.sm,
    },
    nearbyText: {
      flex: 1,
      minWidth: 0,
    },
    nearbyName: {
      fontSize: 16,
      fontFamily: FONTS.heading,
      color: theme.textPrimary,
    },
    nearbyMeta: {
      marginTop: 2,
      fontSize: 13,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    confirmation: {
      marginTop: SPACING.md,
      fontSize: 14,
      lineHeight: 20,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    footer: {
      marginTop: 'auto',
      gap: SPACING.md,
    },
    fine: {
      height: 52,
      borderRadius: RADIUS.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceRaised,
    },
    fineLabel: {
      fontSize: 17,
      fontFamily: FONTS.heading,
      color: theme.textPrimary,
    },
  });
}
