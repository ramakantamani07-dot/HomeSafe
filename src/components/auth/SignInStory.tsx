import React, { useCallback, useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { useReducedMotion } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';

import { FIXED_PALETTES } from '../../config/theme';
import { STORY_SVG } from '../../../assets/signin/storyScene';

const still = require('../../../assets/signin/story-still.png');

/** The artwork's own proportions (viewBox 390 × 230). */
export const STORY_ASPECT = 390 / 230;

// The SVG is animated with SMIL, which WKWebView and Android's WebView play
// natively. Rebuilding it as Lottie or Rive (spec §4) would add a native
// dependency to draw what the platform already draws; see D29.
const HTML = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;height:100%;overflow:hidden;background:${FIXED_PALETTES.signIn.background}}
svg{display:block;width:100%;height:100%}</style>
</head><body>${STORY_SVG}</body></html>`;

/**
 * The sign-in "walk home" story (boards AN1–AN4): the two kids walk to their
 * house while what wayLoc does pops in along the way.
 *
 * Decorative, so it is hidden from screen readers and never takes a touch.
 * It animates only while it can be seen: with Reduce Motion on, or when its
 * screen is covered by the next one in the stack, it shows the still frame
 * instead, and the web view is torn down rather than left animating offscreen.
 */
export function SignInStory({ style }: { style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  const [focused, setFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const animate = focused && !reduceMotion;

  return (
    <View
      style={[styles.frame, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* The still sits underneath, so the web view loading never shows a blank. */}
      <Image source={still} style={StyleSheet.absoluteFill} resizeMode="contain" />
      {animate && (
        <WebView
          source={{ html: HTML }}
          style={styles.web}
          originWhitelist={['*']}
          javaScriptEnabled={false}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          androidLayerType="hardware"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Size comes from the screen; the artwork scales to fit inside it. Clipped,
  // so nothing the web view draws can spill over the screen around it.
  frame: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: FIXED_PALETTES.signIn.background,
  },
  web: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
});
