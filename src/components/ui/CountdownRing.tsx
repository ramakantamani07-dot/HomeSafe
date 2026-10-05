import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

interface CountdownRingProps {
  size: number;
  strokeWidth: number;
  /** 0–1. 1 is a full ring, 0 is empty. Values outside are clamped. */
  progress: number;
  color: string;
  trackColor: string;
  /** Rendered centred inside the ring. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * A circular progress ring built from plain Views.
 *
 * Deliberately not react-native-svg: this is the only shape in the app that
 * needs an arc, and it's a native module — adding one costs every developer
 * and CI job a rebuild, for something two clipped half-rings draw just as
 * well.
 *
 * How it works. A View with `borderRadius = size/2` and two *adjacent*
 * borders coloured draws a clean 180° arc. That arc spans −45°…135° (the top
 * border straddles 12 o'clock, 45° either side), so positioning it at an
 * arbitrary angle means rotating by `angle − 135`. Each half of the ring gets
 * its own overflow-hidden viewport, and the arc slides through it: the right
 * viewport reveals 0–180°, the left one 180–360°.
 */
export function CountdownRing({
  size,
  strokeWidth,
  progress,
  color,
  trackColor,
  children,
  style,
}: CountdownRingProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  const degrees = clamped * 360;
  const half = size / 2;

  // The arc spans [angle − 180, angle]; see the 45° offset note above.
  const rotationFor = (angle: number) => angle - 135;

  // Right viewport shows 0–180°, so its arc stops advancing at 180.
  const rightRotation = rotationFor(Math.min(degrees, 180));
  const leftRotation = rotationFor(degrees);

  const arcStyle: ViewStyle = {
    position: 'absolute',
    top: 0,
    width: size,
    height: size,
    borderRadius: half,
    borderWidth: strokeWidth,
    borderTopColor: color,
    borderRightColor: color,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  };

  return (
    <View style={[{ width: size, height: size }, styles.center, style]}>
      <View
        style={[
          styles.absolute,
          {
            width: size,
            height: size,
            borderRadius: half,
            borderWidth: strokeWidth,
            borderColor: trackColor,
          },
        ]}
      />

      {/* 0–180°: clipped to the right half, arc positioned at the container centre. */}
      <View style={[styles.absolute, styles.clip, { width: half, height: size, left: half }]}>
        <View style={[arcStyle, { left: -half, transform: [{ rotate: `${rightRotation}deg` }] }]} />
      </View>

      {/* 180–360°: only mounted once progress passes halfway. */}
      {degrees > 180 && (
        <View style={[styles.absolute, styles.clip, { width: half, height: size, left: 0 }]}>
          <View style={[arcStyle, { left: 0, transform: [{ rotate: `${leftRotation}deg` }] }]} />
        </View>
      )}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  absolute: {
    position: 'absolute',
  },
  clip: {
    overflow: 'hidden',
  },
});
