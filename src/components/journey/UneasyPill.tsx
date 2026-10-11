import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { ELEVATION, FEATURE_COLORS, FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
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
 *
 * Given more presence than a plain chip (a filled icon, a firmer edge and a
 * line saying what it offers) so it is found before it is needed, while
 * staying violet and outlined: SOS is the only solid, red control here.
 */
export function UneasyPill({ onPress }: UneasyPillProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Feeling uneasy? Call, fake call or tell your circle. Not an emergency."
    >
      <View style={styles.iconDisc}>
        <Icon name="shield" size={18} color={theme.textOnColor} />
      </View>
      <View style={styles.text}>
        <Text style={styles.label}>Feeling uneasy?</Text>
        <Text style={styles.hint} numberOfLines={1}>
          Call, fake call or tell your circle. Not an emergency.
        </Text>
      </View>
      <Icon name="chevronRight" size={18} color={FEATURE_COLORS.uneasy} />
    </Pressable>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      minHeight: 56,
      paddingVertical: SPACING.sm,
      paddingLeft: SPACING.sm,
      paddingRight: SPACING.lg,
      borderRadius: RADIUS.pill,
      // Derived from the feature colour rather than a second literal that
      // would have to be re-tuned by hand whenever that one moves. Over a
      // surface, so it reads on any part of the map.
      backgroundColor: theme.surface,
      borderWidth: 1.5,
      borderColor: `${FEATURE_COLORS.uneasy}73`, // 45% alpha
      ...ELEVATION.float,
    },
    iconDisc: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: FEATURE_COLORS.uneasy,
    },
    text: {
      flex: 1,
      minWidth: 0,
    },
    hint: {
      fontSize: 13,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    pressed: {
      opacity: 0.85,
    },
    label: {
      fontSize: 17,
      fontFamily: FONTS.heading,
      color: FEATURE_COLORS.uneasy,
    },
  });
}
