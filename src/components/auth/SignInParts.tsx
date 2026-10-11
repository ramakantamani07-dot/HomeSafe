import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';

import { ELEVATION, FIXED_PALETTES, FONTS, RADIUS, SPACING } from '../../config/theme';
import { Icon } from '../ui/Icon';

const C = FIXED_PALETTES.signIn;

// Cut from assets/logo-source.png, the app's own logo, at 3× their size here.
// Images rather than a styled Text: they keep the logo's gradient lettering,
// which React Native cannot draw on text.
const logoMark = require('../../../assets/signin/logo-mark.png');
const logoWordmark = require('../../../assets/signin/logo-wordmark.png');

/** The app's logo, mark and wordmark side by side (AN1's header). */
export function BrandLockup() {
  return (
    <View style={styles.lockup} accessible accessibilityRole="header" accessibilityLabel="WayLoc">
      <Image source={logoMark} style={styles.mark} resizeMode="contain" />
      <Image source={logoWordmark} style={styles.wordmark} resizeMode="contain" />
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

const MARK_SIZE = 44;
const WORDMARK_HEIGHT = 24;
/** The wordmark image's own proportions (939 × 243). */
const WORDMARK_ASPECT = 939 / 243;
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
  },
  wordmark: {
    height: WORDMARK_HEIGHT,
    width: WORDMARK_HEIGHT * WORDMARK_ASPECT,
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
