import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
import { defaultFamilyPermissions } from '../../models/Family';
import { Icon, type IconName } from '../ui/Icon';

/**
 * What changes if they accept, shown *before* sending (Phase 5b Invite).
 *
 * Read from the defaults a new connection actually starts with, so the promise
 * is the one the app keeps. If the default ever stops being "during journeys",
 * this copy follows it rather than going stale.
 */
export function WhatIsShared({ name }: { name: string }) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const mode = defaultFamilyPermissions().sharingMode;
  const yours =
    mode === 'SHARE_DURING_JOURNEY'
      ? "Only while you're sharing one"
      : mode === 'SHARE_ALWAYS'
        ? 'All the time'
        : 'Only what you choose';

  return (
    <View style={styles.card}>
      <Row icon="eye" tint={theme.accent} title={`${name} sees your journeys`} detail={yours} styles={styles} theme={theme} />
      <Row
        icon="check"
        tint={theme.safe.fg}
        title={`You see theirs — if they accept`}
        detail="They choose what to share. Change yours anytime in Settings"
        styles={styles}
        theme={theme}
      />
    </View>
  );
}

function Row({
  icon,
  tint,
  title,
  detail,
  styles,
  theme,
}: {
  icon: IconName;
  tint: string;
  title: string;
  detail: string;
  styles: ReturnType<typeof getStyles>;
  theme: ThemeColors;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: tint }]}>
        <Icon name={icon} size={16} color={theme.textOnColor} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    card: { padding: SPACING.lg, borderRadius: RADIUS.lg, backgroundColor: theme.surface, gap: SPACING.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    text: { flex: 1 },
    title: { fontSize: 15, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    detail: { fontSize: 13, fontFamily: FONTS.body, color: theme.textSecondary },
  });
}
