import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
import { Icon } from '../ui/Icon';

/** Spec §3: press-and-hold for 3 s with visible progress. Never a single tap. */
const HOLD_DURATION_MS = 3_000;
const HOLD_TICK_MS = 50;

interface SOSHoldBarProps {
  /**
   * `bar` is the full-width pill used before the Option 15 redesign.
   * `round` is the dock's circular SOS button — same gesture, same guarantees,
   * different shape. Both are the same component so the press-and-hold
   * behaviour can never drift between them.
   */
  variant?: 'bar' | 'round';
  style?: StyleProp<ViewStyle>;
}

/**
 * The SOS bar on screens 01, 06 and 07.
 *
 * Completing the hold here opens screen 09 with the alert already sending —
 * one continuous three-second gesture, not a hold to open followed by a
 * second hold to send. Two separate holds would be the wrong trade in an
 * emergency, and a bar labelled "press and hold" that actually responds to a
 * tap would be a promise the control doesn't keep.
 *
 * Releasing early sends nothing and resets the fill, which is the entire
 * point: this control lives on the home screen, where a pocket tap must never
 * raise an alarm.
 */
export function SOSHoldBar({ variant = 'bar', style }: SOSHoldBarProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();

  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const firedRef = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clear, [clear]);

  const handlePressIn = () => {
    firedRef.current = false;
    setProgress(0);
    const startedAt = Date.now();

    clear();
    timer.current = setInterval(() => {
      const next = Math.min((Date.now() - startedAt) / HOLD_DURATION_MS, 1);
      setProgress(next);

      if (next >= 1 && !firedRef.current) {
        firedRef.current = true;
        clear();
        setProgress(0);
        router.push('/(app)/sos?autosend=true');
      }
    }, HOLD_TICK_MS);
  };

  const handlePressOut = () => {
    clear();
    if (!firedRef.current) setProgress(0);
  };

  const holding = progress > 0;
  const secondsLeft = Math.max(0, Math.ceil((1 - progress) * (HOLD_DURATION_MS / 1_000)));

  if (variant === 'round') {
    return (
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.round, style]}
        accessibilityRole="button"
        accessibilityLabel="Press and hold for three seconds to send an SOS"
        accessibilityHint="Release before it fills to cancel"
      >
        {/* Fill rises from the bottom as the hold progresses — the same
            feedback as the bar, read vertically because the control is round. */}
        <View
          style={[styles.roundFill, { height: `${Math.round(progress * 100)}%` }]}
          pointerEvents="none"
        />
        <Text style={styles.roundLabel} pointerEvents="none">
          {holding ? secondsLeft : 'SOS'}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.bar, style]}
      accessibilityRole="button"
      accessibilityLabel="Press and hold for three seconds to send an SOS"
      accessibilityHint="Release before the bar fills to cancel"
    >
      {/* Fill grows left-to-right behind the label as the hold progresses. */}
      <View
        style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]}
        pointerEvents="none"
      />
      <View style={styles.content} pointerEvents="none">
        <Icon name="warning" size={18} color={theme.critical.fg} />
        <Text style={styles.label}>
          {holding ? `Keep holding… ${secondsLeft}` : 'Press and hold for SOS'}
        </Text>
      </View>
    </Pressable>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    bar: {
      height: 64,
      borderRadius: RADIUS.pill,
      borderWidth: 1.5,
      borderColor: theme.critical.fg,
      backgroundColor: theme.critical.bg,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    fill: {
      ...StyleSheet.absoluteFillObject,
      right: undefined,
      backgroundColor: theme.critical.fg,
      opacity: 0.18,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
    },
    label: {
      fontSize: 18,
      fontFamily: FONTS.heading,
      color: theme.critical.fg,
    },
    round: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: theme.critical.fg,
    },
    roundFill: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.textOnColor,
      opacity: 0.28,
    },
    roundLabel: {
      fontSize: 15,
      fontFamily: FONTS.headingXBold,
      color: theme.textOnColor,
      letterSpacing: 0.5,
    },
  });
}
