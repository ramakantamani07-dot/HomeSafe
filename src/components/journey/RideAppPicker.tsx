import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
import { Icon } from '../ui/Icon';
import { RIDE_APP_NAMES, rideNounBare, type RideApp } from '../../models/Ride';
import type { TravelMode } from '../../models/Place';

interface RideAppPickerProps {
  mode: TravelMode;
  /** Apps WayLoc can open (credential set), in order. */
  apps: readonly RideApp[];
  selected: RideApp | null;
  onSelect(app: RideApp | null): void;
}

/**
 * "Book the auto with (optional)" (rides board AP1).
 *
 * Ride options, never prices (decision 2) and names as plain text, no logos
 * (decision 5). Rapido has no public link, so it is a line of advice rather
 * than a choice — the copy-address button on the journey screen does the
 * work. Nothing is preselected: no app opens unless the traveller picks one.
 */
export function RideAppPicker({ mode, apps, selected, onSelect }: RideAppPickerProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  const option = (app: RideApp | null, title: string, subtitle: string, external: boolean) => {
    const isSelected = selected === app;
    return (
      <TouchableOpacity
        key={app ?? 'self'}
        style={styles.row}
        onPress={() => onSelect(app)}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`${title}. ${subtitle}`}
      >
        <View style={[styles.radio, isSelected && styles.radioOn]}>
          {isSelected && <View style={styles.radioDot} />}
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {external && <Icon name="link" size={18} color={theme.textTertiary} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Book the {rideNounBare(mode)} with (optional)</Text>
      <View style={styles.card}>
        {apps.map((app) =>
          option(app, RIDE_APP_NAMES[app], `Opens ${RIDE_APP_NAMES[app]} with your destination`, true),
        )}
        <View style={styles.row} accessible accessibilityLabel="Rapido. Book in Rapido yourself — no link yet.">
          <View style={styles.radioSpacer} />
          <View style={styles.text}>
            <Text style={styles.title}>Rapido</Text>
            <Text style={styles.subtitle}>Book in Rapido yourself — no link yet</Text>
          </View>
        </View>
        {option(null, "I'll sort it myself", 'Street auto, or someone else books', false)}
      </View>
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    section: { gap: SPACING.sm },
    heading: {
      fontSize: 13,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      fontFamily: FONTS.bodySemibold,
      color: theme.textSecondary,
      paddingHorizontal: SPACING.xs,
    },
    card: {
      borderRadius: RADIUS.lg,
      backgroundColor: theme.surface,
      paddingHorizontal: SPACING.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      minHeight: 64,
      paddingVertical: SPACING.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: { borderColor: theme.accent },
    radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.accent },
    radioSpacer: { width: 24 },
    text: { flex: 1 },
    title: { fontSize: 17, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    subtitle: { fontSize: 14, fontFamily: FONTS.body, color: theme.textSecondary },
  });
}
