import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../config/theme';

export type Severity = 'safe' | 'neutral' | 'warning' | 'critical';

interface StatusBadgeProps {
  label: string;
  severity: Severity;
  /**
   * Overrides the pill's fill (text/dot stay the severity color). Home v2's
   * soft header needs a white pill for legibility over its pattern image —
   * optional so every other call site keeps the default tinted fill.
   */
  background?: string;
}

/**
 * Replaces FamilyStatusBadge's six unrelated hues with the app-wide 3-tier
 * severity system (plus a colorless "neutral" for the common case — most
 * status text isn't an alert and shouldn't look like one). Color is always
 * paired with the label text, never color-alone, so meaning survives without
 * relying on hue perception. See the redesign audit §4/§14.
 */
export function StatusBadge({ label, severity, background }: StatusBadgeProps) {
  const theme = useTheme();

  if (severity === 'neutral') {
    return <Text style={[styles.neutralText, { color: theme.textSecondary }]}>{label}</Text>;
  }

  const { fg, bg } = theme[severity];

  return (
    <View style={[styles.pill, { backgroundColor: background ?? bg }]}>
      <View style={[styles.dot, { backgroundColor: fg }]} />
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export type ConnectivityState = 'live' | 'weak' | 'lost';

interface ConnectivityBadgeProps {
  state: ConnectivityState;
  /** e.g. "Updated now", "Last update 45 sec ago", "Last known location 4 min ago". */
  detail: string;
}

/**
 * Its own small system, separate from severity — a stale reading must never
 * visually resemble a live one. "Lost" deliberately isn't critical-red: it
 * needs attention but isn't an emergency, and the word "lost" already
 * carries that meaning. See the redesign audit §4/§11.
 */
export function ConnectivityBadge({ state, detail }: ConnectivityBadgeProps) {
  const theme = useTheme();
  const color = theme.connectivity[state];
  const label = state === 'live' ? 'Live' : state === 'weak' ? 'Weak connection' : 'Connection lost';

  return (
    <View style={styles.connectivityRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View>
        <Text style={[styles.connectivityLabel, { color }]}>{label}</Text>
        <Text style={[styles.connectivityDetail, { color: theme.textTertiary }]}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  neutralText: {
    fontSize: TYPOGRAPHY.callout.fontSize,
    fontWeight: '500',
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  pillText: {
    fontSize: TYPOGRAPHY.caption.fontSize,
    fontWeight: '700',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectivityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  connectivityLabel: {
    fontSize: TYPOGRAPHY.callout.fontSize,
    fontWeight: '700',
  },
  connectivityDetail: {
    fontSize: TYPOGRAPHY.caption.fontSize,
    marginTop: 1,
  },
});
