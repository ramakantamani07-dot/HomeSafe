import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
import { Icon, type IconName } from '../ui/Icon';

/**
 * "What they get" (trusted-contacts boards).
 *
 * Every line is what the app actually does. The board says "a call, straight
 * away"; nobody is called automatically, so it says "an alert". The text row
 * appears only where texting is live (`smsAlertsEnabled`) — promising a text
 * that will not be sent is the one thing a contacts screen must never do.
 */
export function WhatTheyGet({ smsAlertsEnabled }: { smsAlertsEnabled: boolean }) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const rows: { icon: IconName; tint: string; title: string; detail: string }[] = [
    { icon: 'warning', tint: theme.critical.fg, title: 'Your SOS', detail: 'Your live location and an alert, straight away' },
    { icon: 'time', tint: theme.warning.fg, title: 'Missed check-ins', detail: "If you don't answer “Are you OK?”" },
    ...(smsAlertsEnabled
      ? [{ icon: 'message' as IconName, tint: theme.safe.fg, title: 'A text, even without the app', detail: 'Works on any phone' }]
      : []),
  ];

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>WHAT THEY GET</Text>
      <View style={styles.card}>
        {rows.map((r) => (
          <View key={r.title} style={styles.row}>
            <View style={[styles.icon, { backgroundColor: r.tint }]}>
              <Icon name={r.icon} size={16} color={theme.textOnColor} />
            </View>
            <View style={styles.text}>
              <Text style={styles.title}>{r.title}</Text>
              <Text style={styles.detail}>{r.detail}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    wrap: { gap: SPACING.sm },
    label: { fontSize: 12, fontFamily: FONTS.bodySemibold, letterSpacing: 0.6, color: theme.textSecondary },
    card: { padding: SPACING.lg, borderRadius: RADIUS.lg, backgroundColor: theme.surface, gap: SPACING.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    text: { flex: 1 },
    title: { fontSize: 15, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    detail: { fontSize: 13, fontFamily: FONTS.body, color: theme.textSecondary },
  });
}
