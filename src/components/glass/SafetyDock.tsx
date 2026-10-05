import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FEATURE_COLORS, FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
import { Icon } from '../ui/Icon';
import { GlassSurface } from '../ui/GlassSurface';
import { SOSHoldBar } from '../journey/SOSHoldBar';

interface SafetyDockProps {
  /** "Check in" on Home, "I'm OK" while a journey is running. */
  checkInLabel: string;
  onCheckIn(): void;
  onFakeCall(): void;
  style?: StyleProp<ViewStyle>;
}

/**
 * The safety dock — `Check in / I'm OK · Fake call · SOS`.
 *
 * Option 15 §1 principle 3: this sits in the *same position* on Home and On the
 * way, with SOS always bottom-right. That consistency is the point — in an
 * emergency the control must be where muscle memory expects it, not wherever
 * the current screen's layout happened to put it. It is one component for
 * exactly that reason: two copies would drift.
 */
export function SafetyDock({ checkInLabel, onCheckIn, onFakeCall, style }: SafetyDockProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <View style={[styles.dock, style]}>
      <GlassSurface style={styles.capsule}>
        <View style={styles.capsuleRow}>
          <TouchableOpacity
            style={styles.action}
            onPress={onCheckIn}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={checkInLabel}
          >
            <Icon name="check" size={18} color={theme.safe.fg} />
            <Text style={[styles.actionLabel, { color: theme.safe.fg }]} numberOfLines={1}>
              {checkInLabel}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.action}
            onPress={onFakeCall}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Fake call"
          >
            <Icon name="call" size={18} color={FEATURE_COLORS.fakeCall} />
            <Text style={[styles.actionLabel, { color: theme.textPrimary }]} numberOfLines={1}>
              Fake call
            </Text>
          </TouchableOpacity>
        </View>
      </GlassSurface>

      {/*
        Press-and-hold, never a tap — and the round red button is deliberately
        outside the glass capsule so it reads as a separate, heavier control
        that cannot be hit while reaching for Check in.
      */}
      <SOSHoldBar variant="round" style={styles.sos} />
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    dock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    capsule: {
      flex: 1,
      minHeight: 56,
      justifyContent: 'center',
    },
    capsuleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    action: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.sm,
      minHeight: 44,
    },
    actionLabel: {
      fontSize: 16,
      fontFamily: FONTS.bodySemibold,
    },
    divider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      marginVertical: SPACING.sm,
      backgroundColor: theme.border,
    },
    sos: {
      width: 56,
      height: 56,
      borderRadius: RADIUS.pill,
    },
  });
}
