import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { FEATURE_COLORS, FONTS, RADIUS, SPACING, type ThemeColors } from '../../src/config/theme';
import { useFamily } from '../../src/hooks/useFamily';
import { useFakeCall } from '../../src/hooks/useFakeCall';
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

  const firstGuardian = members.length > 0 ? members[0] : null;

  const callGuardian = () => {
    if (!firstGuardian) return;
    const scheme = Platform.OS === 'ios' ? 'tel://' : 'tel:';
    // Failing silently is right here: a device with no dialler (iPad, simulator)
    // should not throw an error dialog at someone who is already uneasy.
    Linking.openURL(`${scheme}${firstGuardian.phoneNumber}`).catch(() => {});
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
            startFakeCall();
            router.push('/(app)/fake-incoming-call');
          }}
        />
      </View>

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
