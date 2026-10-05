import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

import { useTheme } from '../../context/ThemeContext';
import { GLASS, RADIUS } from '../../config/theme';

/**
 * How translucent the surface is.
 *
 * Floating controls sit directly on the map and want the map to read through
 * them. Sheets carry body text over arbitrary map imagery and need a denser
 * fill — Option 15 §2 is explicit that sheets use stronger glass "so text stays
 * readable over the map". That is a legibility requirement, not a style
 * preference, so it is a named variant rather than a prop someone can tune
 * downwards at a call site.
 */
export type GlassVariant = 'control' | 'sheet';

interface GlassSurfaceProps {
  children?: React.ReactNode;
  variant?: GlassVariant;
  /** Defaults to the pill radius for controls, the sheet radius for sheets. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** Pass through so a floating surface doesn't swallow taps meant for the map. */
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
}

/**
 * The app's glass material, and the **only** place that branches on platform
 * for it.
 *
 * Option 15 specifies four different implementations depending on OS version.
 * Every one of them is here so that no screen ever has to know which it got:
 *
 *   iOS            `expo-blur` renders a real backdrop blur (UIVisualEffectView)
 *   Android 31+    `expo-blur` maps to RenderEffect
 *   Android < 31   no backdrop blur exists — a near-opaque solid instead
 *   Reduced transparency / dark mode   solid, see below
 *
 * **Dark mode deliberately drops the blur.** The spec's glass is a white fill
 * over a light map; the same treatment over a dark map reads as grey haze and
 * loses the text contrast the sheet variant exists to protect. Dark mode gets
 * an opaque raised surface instead — the same decision the earlier design
 * handoff reached for its header pattern.
 */
export function GlassSurface({
  children,
  variant = 'control',
  radius,
  style,
  pointerEvents,
}: GlassSurfaceProps) {
  const theme = useTheme();
  const tokens = GLASS[variant];
  const cornerRadius = radius ?? (variant === 'sheet' ? RADIUS.sheet : RADIUS.pill);

  const shared: ViewStyle = {
    borderRadius: cornerRadius,
    overflow: 'hidden',
  };

  // Android below API 31 has no backdrop-blur primitive at all, and dark mode
  // opts out by design — both fall back to a solid surface rather than a
  // washed-out approximation of one.
  const blurUnavailable =
    theme.isDark || (Platform.OS === 'android' && (Platform.Version as number) < 31);

  if (blurUnavailable) {
    return (
      <View
        pointerEvents={pointerEvents}
        style={[
          shared,
          {
            backgroundColor: theme.isDark ? theme.surfaceRaised : tokens.solidFallback,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.isDark ? theme.border : tokens.rim,
          },
          tokens.shadow,
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <View pointerEvents={pointerEvents} style={[shared, tokens.shadow, style]}>
      <BlurView intensity={tokens.intensity} tint="light" style={StyleSheet.absoluteFill} />
      {/*
        The blur alone is too transparent for text at either variant's spec'd
        opacity, so a white wash sits on top of it. Separating the two is what
        lets the sheet be denser than a control without needing a second blur
        intensity — and keeps the rim a single hairline over both.
      */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: tokens.fill,
            borderRadius: cornerRadius,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: tokens.rim,
          },
        ]}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}
