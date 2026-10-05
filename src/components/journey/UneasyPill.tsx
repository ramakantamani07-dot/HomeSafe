import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FEATURE_COLORS, FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
import { Icon } from '../ui/Icon';

interface UneasyPillProps {
  onPress(): void;
}

/**
 * "Feeling uneasy?" — the entry point to `AI5` (Option 15 §D, item 2).
 *
 * Sits between the ETA capsule and the safety dock, which is deliberate: it is
 * the step *before* an emergency, and must not read like one. It uses the
 * feature's own violet rather than the critical red reserved for SOS, so a
 * traveller who is merely uncomfortable is not asked to decide whether their
 * situation qualifies as an emergency.
 */
export function UneasyPill({ onPress }: UneasyPillProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Feeling uneasy? Get help without raising an alarm"
    >
      <Icon name="shield" size={18} color={FEATURE_COLORS.uneasy} />
      <Text style={styles.label}>Feeling uneasy?</Text>
    </Pressable>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      height: 48,
      borderRadius: RADIUS.pill,
      // Derived from the feature colour rather than a second literal that
      // would have to be re-tuned by hand whenever that one moves.
      backgroundColor: `${FEATURE_COLORS.uneasy}1A`, // 10% alpha
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${FEATURE_COLORS.uneasy}33`,
    },
    pressed: {
      opacity: 0.85,
    },
    label: {
      fontSize: 16,
      fontFamily: FONTS.heading,
      color: FEATURE_COLORS.uneasy,
    },
  });
}
