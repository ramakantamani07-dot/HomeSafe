import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { RADIUS, type ThemeColors } from '../../config/theme';
import { Icon } from '../ui/Icon';

/**
 * How far along their route someone is (Option 15 S2b, S2c).
 *
 * Drawn only from a measured fraction (`measureJourneyProgress`); callers pass
 * nothing when there is none, and the bar is not shown — an empty or guessed
 * bar would look like a fact.
 */
export function JourneyProgressBar({ fraction, dotColor }: { fraction: number; dotColor: string }) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const pct = `${Math.round(Math.min(Math.max(fraction, 0), 1) * 100)}%` as const;

  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: pct }]} />
        <View style={[styles.dot, { left: pct, backgroundColor: dotColor }]} />
      </View>
      <View style={styles.end}>
        <Icon name="home" size={12} color={theme.textOnColor} />
      </View>
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 24 },
    track: { flex: 1, height: 4, borderRadius: RADIUS.pill, backgroundColor: theme.border, justifyContent: 'center' },
    fill: { position: 'absolute', left: 0, height: 4, borderRadius: RADIUS.pill, backgroundColor: theme.accent },
    dot: {
      position: 'absolute',
      width: 14,
      height: 14,
      marginLeft: -7,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: theme.surface,
    },
    end: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.safe.fg,
    },
  });
}
