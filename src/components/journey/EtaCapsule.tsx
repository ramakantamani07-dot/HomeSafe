import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
import { CountdownRing } from '../ui/CountdownRing';
import { identityColor } from '../../config/theme';

interface EtaCapsuleProps {
  /** "3 min", or null while the route is still being worked out. */
  minutesLabel: string | null;
  /** "21:44 · NN2 8ET · check-in 4 min" — composed by the caller. */
  detail: string;
  /** First guardian's initial, shown inside the ring. Null when nobody is watching. */
  guardianInitial: string | null;
  /** Stable id behind the guardian's avatar colour, so it matches elsewhere. */
  guardianId: string | null;
  /** 0–1 of the check-in window still remaining. 1 is a full ring. */
  checkInProgress: number;
  /** True once the check-in window is nearly gone — the ring turns amber. */
  checkInUrgent: boolean;
  onEnd(): void;
  endBusy?: boolean;
}

/** Diameter of the guardian avatar ring. Big enough to read an initial inside. */
const RING_SIZE = 46;
const RING_STROKE = 3;

/**
 * The ETA capsule on "On the way" (Option 15 `AI4` §D, item 1).
 *
 * Three things share one row because they answer one question — "how is this
 * going?": how long is left, who is watching, and the way out. The guardian's
 * avatar sits *inside* the check-in countdown ring rather than beside it,
 * because the ring is about them: it is counting down to the moment they get
 * told something is wrong.
 */
export function EtaCapsule({
  minutesLabel,
  detail,
  guardianInitial,
  guardianId,
  checkInProgress,
  checkInUrgent,
  onEnd,
  endBusy = false,
}: EtaCapsuleProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  const ringColor = checkInUrgent ? theme.warning.fg : theme.accent;

  return (
    <View style={styles.capsule}>
      <View style={styles.text}>
        <Text style={styles.minutes} numberOfLines={1}>
          {minutesLabel ?? 'Working out your route…'}
        </Text>
        <Text style={styles.detail} numberOfLines={1}>
          {detail}
        </Text>
      </View>

      {guardianInitial && (
        <CountdownRing
          size={RING_SIZE}
          strokeWidth={RING_STROKE}
          progress={checkInProgress}
          color={ringColor}
          trackColor={theme.border}
          style={styles.ring}
        >
          <View
            style={[
              styles.avatar,
              { backgroundColor: identityColor(theme, guardianId ?? guardianInitial) },
            ]}
          >
            <Text style={styles.avatarText}>{guardianInitial}</Text>
          </View>
        </CountdownRing>
      )}

      <Pressable
        onPress={onEnd}
        disabled={endBusy}
        style={({ pressed }) => [styles.end, pressed && styles.endPressed]}
        accessibilityRole="button"
        accessibilityLabel="End journey"
      >
        <Text style={styles.endLabel}>{endBusy ? '…' : 'End'}</Text>
      </Pressable>
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    capsule: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.lg,
      backgroundColor: theme.surface,
    },
    text: {
      flex: 1,
      minWidth: 0,
    },
    minutes: {
      fontSize: 22,
      fontFamily: FONTS.headingXBold,
      color: theme.textPrimary,
      letterSpacing: -0.4,
    },
    detail: {
      marginTop: 2,
      fontSize: 13,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    ring: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatar: {
      width: RING_SIZE - RING_STROKE * 4,
      height: RING_SIZE - RING_STROKE * 4,
      borderRadius: (RING_SIZE - RING_STROKE * 4) / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 14,
      fontFamily: FONTS.heading,
      color: theme.textOnColor,
    },
    end: {
      paddingHorizontal: SPACING.lg,
      height: 40,
      borderRadius: RADIUS.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceRaised,
    },
    endPressed: {
      opacity: 0.8,
    },
    endLabel: {
      fontSize: 15,
      fontFamily: FONTS.heading,
      color: theme.textPrimary,
    },
  });
}
