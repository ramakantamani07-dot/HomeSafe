import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
import type { LocateAudit } from '../../models/LocateAudit';
import { describeRadius, formatFindTime } from './findCopy';

/**
 * "Last finds" on a member's screen (Option 15 S3).
 *
 * Lookups that reached the network — found, or the phone could not be reached.
 * Refusals (before YES, too soon) are in the audit but not here: they located
 * no one, and listing them would bury the finds a guardian is looking for.
 *
 * The board marks each row "Sam texted ✓". The server texts at most once an
 * hour and does not record which find a text went with, so a per-row tick would
 * claim something unknown. The screen states the rule once instead.
 */
export function LastFinds({ audits, now }: { audits: LocateAudit[]; now: Date }) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const shown = audits.filter((a) => a.outcome === 'success' || a.outcome === 'provider-error');

  if (shown.length === 0) {
    return <Text style={styles.empty}>No finds yet.</Text>;
  }

  return (
    <View style={styles.card}>
      {shown.map((a, i) => (
        <View key={a.id} style={[styles.row, i > 0 && styles.rowDivider]}>
          <Text style={styles.when}>{formatFindTime(a.at, now)}</Text>
          <Text style={styles.detail}>
            {a.outcome === 'success' && a.accuracyMeters !== null
              ? describeRadius(a.accuracyMeters)
              : a.outcome === 'success'
                ? 'Found'
                : "Couldn't reach their phone"}
          </Text>
        </View>
      ))}
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    card: { borderRadius: RADIUS.lg, backgroundColor: theme.surface, paddingHorizontal: SPACING.lg },
    row: { paddingVertical: SPACING.md, gap: 2 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
    when: { fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    detail: { fontSize: 14, fontFamily: FONTS.body, color: theme.textSecondary },
    empty: { fontSize: 15, fontFamily: FONTS.body, color: theme.textSecondary, paddingHorizontal: SPACING.xs },
  });
}
