import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';

import { ELEVATION, FIXED_PALETTES, FONTS, RADIUS, SPACING } from '../../config/theme';
import { Icon } from '../ui/Icon';

const C = FIXED_PALETTES.signIn;

/** The gradient pin tile and the wordmark (AN1's header). */
export function BrandLockup() {
  return (
    <View style={styles.lockup} accessible accessibilityRole="header" accessibilityLabel="WayLoc">
      <View style={styles.mark}>
        <Icon name="pin" size={22} color={C.onBrand} />
      </View>
      {/* Solid brand blue: React Native cannot clip a gradient to text. */}
      <Text style={styles.wordmark}>WayLoc</Text>
    </View>
  );
}

/**
 * "DEV · any code works". Defined only under `__DEV__` and rendered only
 * behind `__DEV__ &&`, so a release bundle contains neither the component nor
 * its text — compiled out, not hidden (spec §4).
 */
export const DevPill: (props: { style?: StyleProp<ViewStyle> }) => React.ReactElement | null = __DEV__
  ? ({ style }) => (
      <View style={[styles.devPill, style]} accessible accessibilityLabel="Development build: any code works">
        <View style={styles.devDot} />
        <Text style={styles.devText}>DEV · any code works</Text>
      </View>
    )
  : () => null;

/** The frosted light sheet every sign-in screen puts its controls on. */
export function SignInSheet({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.sheet, style]}>{children}</View>;
}

/** The round glass back button on the code screens. */
export function SignInBackButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress}
      style={styles.back}
      activeOpacity={0.7}
    >
      <Icon name="chevronLeft" size={22} color={C.ink} />
    </TouchableOpacity>
  );
}

const MARK_SIZE = 40;
const BACK_SIZE = 44;

const styles = StyleSheet.create({
  lockup: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 2,
  },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.brand,
    experimental_backgroundImage: C.markGradient,
    ...ELEVATION.sm,
  },
  wordmark: {
    fontFamily: FONTS.headingXBold,
    fontSize: 22,
    // No negative letter-spacing: iOS measures the text without it and clips
    // the last letter ("WayLo").
    color: C.brand,
  },
  devPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 26,
    paddingHorizontal: SPACING.sm + 2,
    borderRadius: RADIUS.pill,
    backgroundColor: C.devFill,
  },
  devDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.devDot,
  },
  devText: {
    fontFamily: FONTS.bodySemibold,
    fontSize: 11,
    letterSpacing: 0.4,
    color: C.devText,
  },
  sheet: {
    marginHorizontal: 6,
    borderRadius: RADIUS.sheet,
    borderWidth: 1,
    borderColor: C.sheetEdge,
    backgroundColor: C.sheet,
    paddingHorizontal: 18,
    paddingTop: 22,
    gap: 14,
    ...ELEVATION.md,
  },
  back: {
    width: BACK_SIZE,
    height: BACK_SIZE,
    borderRadius: BACK_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.field,
    borderWidth: 1,
    borderColor: C.sheetEdge,
    ...ELEVATION.md,
  },
});
