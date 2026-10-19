import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, SPACING, type ThemeColors } from '../../config/theme';
import type { RideTimelineStep } from '../../models/Ride';

/**
 * A ride as family see it on Watch live (rides board AP5): started, getting
 * the ride, in it, there. Steps come from `guardianRideTimeline`, so "In the
 * auto" stays grey until the traveller says so — never inferred.
 */
export function GuardianRideTimeline({ steps }: { steps: readonly RideTimelineStep[] }) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const dot = (state: RideTimelineStep['state']) =>
    state === 'done' ? theme.safe.fg : state === 'now' ? theme.warning.fg : theme.border;

  return (
    <View>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const label = [step.title, step.detail, step.state === 'pending' ? 'not yet' : step.meta]
          .filter(Boolean)
          .join('. ');
        return (
          <View key={step.title} style={styles.row} accessible accessibilityLabel={label}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: dot(step.state) }]} />
              {!last && (
                <View style={[styles.connector, step.state === 'pending' && styles.connectorPending]} />
              )}
            </View>
            <View style={[styles.body, !last && styles.bodyGap]}>
              <View style={styles.titleRow}>
                <Text
                  style={[styles.title, step.state === 'pending' && styles.titlePending]}
                  numberOfLines={1}
                >
                  {step.title}
                </Text>
                {step.meta ? <Text style={styles.meta}>{step.meta}</Text> : null}
              </View>
              {step.detail ? <Text style={styles.detail}>{step.detail}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', gap: SPACING.md },
    rail: { width: 14, alignItems: 'center' },
    dot: { width: 14, height: 14, borderRadius: 7, marginTop: 4 },
    connector: { flex: 1, width: 2, backgroundColor: theme.border, marginVertical: 2 },
    connectorPending: { opacity: 0.5 },
    body: { flex: 1 },
    bodyGap: { paddingBottom: SPACING.md },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.sm },
    title: { flexShrink: 1, fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    titlePending: { color: theme.textSecondary },
    meta: { fontSize: 14, fontFamily: FONTS.bodySemibold, color: theme.textSecondary },
    detail: { fontSize: 14, fontFamily: FONTS.body, color: theme.textSecondary },
  });
}
