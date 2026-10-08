import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
import { Icon } from '../ui/Icon';
import { haptics } from '../../utils/haptics';
import { useSafetyPreferences } from '../../context/SafetyPreferencesContext';
import {
  sosHoldProgress,
  sosTierForHold,
  tier2For,
  type SOSTier,
} from '../../models/SOS';

/**
 * Option 15 `AI8`: one continuous press-and-hold expressing two intents —
 * 3 s alerts guardians, 6 s additionally offers emergency services. Never a
 * single tap. Thresholds and the tier maths live in models/SOS.ts so they are
 * testable without a renderer.
 */
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
  const { preferences } = useSafetyPreferences();
  const tier1Ms = preferences.sosHoldMs;

  const [progress, setProgress] = useState(0);
  const [tier, setTier] = useState<SOSTier>(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const firedRef = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clear, [clear]);

  const startedAtRef = useRef(0);
  /** Highest tier already felt, so a 50ms tick cannot buzz twice for one crossing. */
  const buzzedTierRef = useRef<SOSTier>(0);

  const fire = useCallback(
    (tier: SOSTier) => {
      if (firedRef.current || tier === 0) return;
      firedRef.current = true;
      clear();
      setProgress(0);
      setTier(0);
      router.push(`/(app)/sos?autosend=true&tier=${tier}`);
    },
    [clear, router],
  );

  const handlePressIn = () => {
    firedRef.current = false;
    setProgress(0);
    setTier(0);
    buzzedTierRef.current = 0;
    startedAtRef.current = Date.now();

    clear();
    timer.current = setInterval(() => {
      const held = Date.now() - startedAtRef.current;
      const reached = sosTierForHold(held, tier1Ms);
      setProgress(sosHoldProgress(held, tier1Ms));
      setTier(reached);

      // The point of this buzz: at 3 s the user learns their guardians have
      // been told without having to look at the screen.
      if (reached > buzzedTierRef.current) {
        buzzedTierRef.current = reached;
        haptics.sosTierReached(reached as 1 | 2);
      }

      // Tier 2 is the maximum, so there is nothing further to express by
      // holding on — send it rather than making them wait to lift a finger.
      if (held >= tier2For(tier1Ms)) fire(2);
    }, HOLD_TICK_MS);
  };

  /**
   * Releasing sends whatever tier the hold reached.
   *
   * The alert therefore goes out when the gesture *completes* rather than the
   * instant tier 1 is crossed — at most ~3 s later than the spec's literal
   * reading. That is the price of letting one gesture carry two intents, and it
   * buys the user the ability to escalate without lifting and pressing again,
   * which in an emergency is worth more than those seconds.
   */
  const handlePressOut = () => {
    const held = Date.now() - startedAtRef.current;
    clear();
    const reached = sosTierForHold(held, tier1Ms);
    if (reached > 0) {
      fire(reached);
    } else {
      setProgress(0);
      setTier(0);
    }
  };

  const holding = progress > 0 || tier > 0;
  const tierSpanMs = tier1Ms; // tier 2 is the same span again — see tier2For
  const secondsLeft = Math.max(0, Math.ceil((1 - progress) * (tierSpanMs / 1_000)));

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
          {holding ? (tier >= 1 ? secondsLeft || '!' : secondsLeft) : 'SOS'}
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
          {!holding
            ? 'Press and hold for SOS'
            : tier >= 1
              ? `Guardians ready · hold ${secondsLeft} more to call for help`
              : `Keep holding… ${secondsLeft}`}
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
