import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, SPACING } from '../../config/theme';
import { GlassSurface } from '../ui/GlassSurface';

interface GlassPillProps {
  children?: React.ReactNode;
  /** Convenience for the common "icon + label" pill; ignored when children are given. */
  label?: string;
  /** Renders as a button when supplied. Required alongside accessibilityLabel. */
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The floating glass pill used for the guardian status chip and the map
 * controls (Option 15 `AI1`).
 *
 * Height is fixed at the 44pt minimum touch target rather than derived from
 * content, so a pill that happens to hold a short label is still comfortably
 * tappable.
 */
export function GlassPill({
  children,
  label,
  onPress,
  accessibilityLabel,
  style,
}: GlassPillProps) {
  const theme = useTheme();

  const content = children ?? (
    <Text style={[styles.label, { color: theme.textPrimary }]} numberOfLines={1}>
      {label}
    </Text>
  );

  if (!onPress) {
    return (
      <GlassSurface style={[styles.pill, style]}>
        <View style={styles.row}>{content}</View>
      </GlassSurface>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={style}
    >
      <GlassSurface style={styles.pill}>
        <View style={styles.row}>{content}</View>
      </GlassSurface>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  label: {
    fontSize: 15,
    fontFamily: FONTS.bodySemibold,
  },
});
