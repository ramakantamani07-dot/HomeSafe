import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, SPACING, type ThemeColors } from '../../config/theme';

/**
 * What a step represents, which decides its dot colour.
 *
 * `openPlace` is amber because Option 15 uses amber for "safe spots / open
 * places" — somewhere to stop if you feel uneasy. It is deliberately not the
 * warning amber's meaning: the dot says *opportunity*, and the label beside it
 * carries the actual sense, so colour is never the only signal.
 */
export type TimelineStepKind = 'start' | 'leg' | 'openPlace' | 'arrival';

interface TimelineStepProps {
  title: string;
  /** "Main road most of the way", "A place to stop if you need". */
  detail?: string;
  /** "21:39", "3 min". */
  meta?: string;
  kind: TimelineStepKind;
  /** Omits the connector below the last step. */
  isLast?: boolean;
}

/**
 * One row of the Route screen's journey timeline (Option 15 `AI3`).
 */
export function TimelineStep({ title, detail, meta, kind, isLast }: TimelineStepProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  const dotColor =
    kind === 'start'
      ? theme.safe.fg
      : kind === 'openPlace'
        ? theme.warm
        : kind === 'arrival'
          ? theme.textPrimary
          : theme.accent;

  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        {!isLast && <View style={styles.connector} />}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        </View>
        {detail ? (
          <Text style={styles.detail} numberOfLines={2}>{detail}</Text>
        ) : null}
      </View>
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: SPACING.md,
    },
    rail: {
      alignItems: 'center',
      width: 12,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginTop: 6,
    },
    connector: {
      flex: 1,
      width: StyleSheet.hairlineWidth * 2,
      backgroundColor: theme.border,
      marginVertical: 4,
      minHeight: 20,
    },
    body: {
      flex: 1,
      paddingBottom: SPACING.lg,
      gap: 2,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: SPACING.md,
    },
    title: {
      flex: 1,
      fontSize: 16,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
    meta: {
      fontSize: 14,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    detail: {
      fontSize: 14,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
      lineHeight: 19,
    },
  });
}
