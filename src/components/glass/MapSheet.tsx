import React, { useCallback, useImperativeHandle, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../context/ThemeContext';
import { GlassSurface } from '../ui/GlassSurface';
import { GLASS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
import { SHEET_DETENTS, SHEET_DETENT } from '../../navigation/sheetPresentation';

export type SheetDetentIndex = 0 | 1 | 2;

export interface MapSheetHandle {
  /** Animate to a named height. Used by the search row to expand to full. */
  snapTo(detent: SheetDetentIndex): void;
}

interface MapSheetProps {
  children: React.ReactNode;
  /** Pinned above the scrolling content — the search row and safety dock. */
  header?: React.ReactNode;
  initialDetent?: SheetDetentIndex;
  onDetentChange?(detent: SheetDetentIndex): void;
  handleRef?: React.Ref<MapSheetHandle>;
  style?: StyleProp<ViewStyle>;
}

/**
 * Home's persistent pull-up sheet (Option 15 `AI1`).
 *
 * Why this is hand-built rather than the OS sheet: `UISheetPresentationController`
 * — which `react-native-screens` uses, and which we *do* use for the genuinely
 * modal sheets (see PRESENTED_SHEET_OPTIONS) — is a presentation primitive. It
 * has no embedded mode. Home's sheet is part of the screen and must never
 * dismiss, so there is no iOS native primitive that fits. Android's
 * BottomSheetBehavior would, but a sheet that behaves differently per platform
 * is worse than one we control on both.
 *
 * Built on reanimated + gesture-handler so the drag runs on the UI thread. A
 * JS-driven drag would stutter against a live map, and this sheet sits over one
 * permanently.
 */
export function MapSheet({
  children,
  header,
  initialDetent = SHEET_DETENT.half,
  onDetentChange,
  handleRef,
  style,
}: MapSheetProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // The highest the sheet's top edge may go: below the status bar, with a
  // sliver of map showing, the way iOS's own sheets stop. A full-height sheet
  // previously reached y = 0, putting the search field and its clear button
  // under the clock, signal and battery — visible clutter, and the ✕ sat
  // inside the system's touch area for the status bar.
  const topLimit = insets.top + SPACING.sm;

  // Detents are fractions of screen height (see SHEET_DETENTS); translateY is
  // measured from the top of the screen, so the smallest detent has the largest
  // offset. "Full" means as high as `topLimit` allows, never higher.
  const offsets = useMemo(
    () => SHEET_DETENTS.map((fraction) => Math.max(screenHeight * (1 - fraction), topLimit)),
    [screenHeight, topLimit],
  );
  // Sized to what is visible at full, so the bottom of the content — and its
  // home-indicator padding — is not pushed off-screen by the top limit.
  const sheetHeight = screenHeight - topLimit;

  const translateY = useSharedValue(offsets[initialDetent]);
  const startY = useSharedValue(0);
  const currentDetent = useSharedValue<SheetDetentIndex>(initialDetent);

  const notifyDetent = useCallback(
    (detent: SheetDetentIndex) => onDetentChange?.(detent),
    [onDetentChange],
  );

  const snapTo = useCallback(
    (detent: SheetDetentIndex) => {
      currentDetent.value = detent;
      translateY.value = withSpring(offsets[detent], SPRING);
      notifyDetent(detent);
    },
    [offsets, translateY, currentDetent, notifyDetent],
  );

  useImperativeHandle(handleRef, () => ({ snapTo }), [snapTo]);

  const pan = Gesture.Pan()
    // The header carries real controls — the search field, its clear button and
    // the Settings avatar. A Pan claims the touch on touch-DOWN, so without a
    // movement threshold it swallowed every tap on them before the underlying
    // Pressable ever saw it; the buttons looked dead. Requiring ~8px of vertical
    // travel before the drag activates lets a stationary tap fall through to the
    // child, while a deliberate drag still grabs the sheet immediately.
    .activeOffsetY([-DRAG_ACTIVATION_SLOP_PX, DRAG_ACTIVATION_SLOP_PX])
    .onStart(() => {
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      const next = startY.value + event.translationY;
      // Clamp to the detent range. Rubber-banding past the top would imply the
      // sheet can be dismissed, and this one never can.
      translateY.value = Math.min(
        Math.max(next, offsets[offsets.length - 1]),
        offsets[0],
      );
    })
    .onEnd((event) => {
      // Project where the drag would land with its current velocity, then pick
      // the nearest detent to *that* rather than to the finger. Snapping to
      // where the finger stopped ignores a deliberate flick and feels sticky.
      const projected = translateY.value + event.velocityY * VELOCITY_PROJECTION_SECONDS;

      let nearest: SheetDetentIndex = 0;
      let smallestDistance = Infinity;
      for (let i = 0; i < offsets.length; i++) {
        const distance = Math.abs(offsets[i] - projected);
        if (distance < smallestDistance) {
          smallestDistance = distance;
          nearest = i as SheetDetentIndex;
        }
      }

      translateY.value = withSpring(offsets[nearest], SPRING);
      if (nearest !== currentDetent.value) {
        currentDetent.value = nearest;
        runOnJS(notifyDetent)(nearest);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[styles.sheet, { height: sheetHeight }, sheetStyle, style]}
      // box-none so the map stays tappable through the sheet's own bounds
      // wherever the sheet isn't actually drawn.
      pointerEvents="box-none"
    >
      {/*
        The sheet's material, behind everything else.
        Option 15 §2 specifies glass for sheets so the map stays visible through
        them — this previously painted GLASS.sheet.solidFallback directly, which
        is the *Android-under-31* colour for devices with no backdrop blur, on a
        phone perfectly capable of one. GlassSurface stays the only thing in the
        app that knows how glass is produced per platform, including dropping
        the blur in dark mode, so the sheet asks for the material by name rather
        than reimplementing it.
      */}
      <GlassSurface
        variant="sheet"
        radius={RADIUS.sheet}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/*
        Only the grabber and header respond to the drag. Attaching the pan to
        the whole sheet would fight any list inside it for the same gesture.
      */}
      <GestureDetector gesture={pan}>
        <View style={styles.dragArea}>
          <View style={styles.grabber} />
          {header}
        </View>
      </GestureDetector>

      <View style={[styles.body, { paddingBottom: insets.bottom }]}>{children}</View>
    </Animated.View>
  );
}

/**
 * Deliberately a low-stiffness, non-bouncy spring. A sheet that overshoots and
 * settles reads as playful; this one sits over a live safety map and should
 * feel like it was placed, not thrown.
 */
const SPRING = { damping: 28, stiffness: 240, mass: 0.9 } as const;

/**
 * How far ahead a flick is projected when choosing the destination detent,
 * in seconds of travel at release velocity.
 */
const VELOCITY_PROJECTION_SECONDS = 0.12;

/**
 * Vertical travel before a touch on the sheet header counts as a drag rather
 * than a tap on whatever control sits under the finger.
 */
const DRAG_ACTIVATION_SLOP_PX = 8;

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      borderTopLeftRadius: RADIUS.sheet,
      borderTopRightRadius: RADIUS.sheet,
      // No background or shadow here: GlassSurface fills the sheet exactly and
      // owns both, so the material has a single source rather than a solid
      // underlay fighting the blur and a second shadow doubling the first.
    },
    dragArea: {
      paddingTop: SPACING.sm,
      borderTopLeftRadius: RADIUS.sheet,
      borderTopRightRadius: RADIUS.sheet,
    },
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.borderStrong,
      marginBottom: SPACING.sm,
    },
    body: {
      flex: 1,
    },
  });
}
