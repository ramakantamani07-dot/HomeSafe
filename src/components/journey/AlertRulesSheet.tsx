import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import {
  LATE_THRESHOLD_OPTIONS,
  NO_REPLY_OPTIONS,
  type AlertRules,
} from '../../models/AlertRules';

interface AlertRulesSheetProps {
  visible: boolean;
  rules: AlertRules;
  /** Real guardian names, so the copy says who gets alerted. */
  guardians: string;
  onSave(rules: AlertRules): void;
  onDismiss(): void;
}

/**
 * The editor behind screen 04's "Edit" link.
 *
 * Only the two thresholds the user has a real opinion about are editable —
 * how long before we ask, and how long they have to answer. The low-battery
 * rule is shown but fixed: it's a safety floor, and letting someone set it to
 * 1% would defeat the point of sending a last known location at all.
 */
export function AlertRulesSheet({
  visible,
  rules,
  guardians,
  onSave,
  onDismiss,
}: AlertRulesSheetProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [draft, setDraft] = useState<AlertRules>(rules);

  // Re-seed each time the sheet opens so a cancelled edit doesn't linger.
  useEffect(() => {
    if (visible) setDraft(rules);
  }, [visible, rules]);

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>If something seems off</Text>
        <Text style={styles.subtitle}>
          These decide when we check on you, and when {guardians} hear about it.
        </Text>

        <Text style={styles.groupLabel}>Ask if I'm OK when I'm this late, or stopped this long</Text>
        <View style={styles.chipRow}>
          {LATE_THRESHOLD_OPTIONS.map((minutes) => {
            const selected = draft.lateMinutes === minutes;
            return (
              <TouchableOpacity
                key={minutes}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() =>
                  // Late and stopped move together: two separate numbers here
                  // gave people a knob to fiddle with and no better outcome.
                  setDraft((d) => ({ ...d, lateMinutes: minutes, stoppedMinutes: minutes }))
                }
                activeOpacity={0.75}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${minutes} minutes`}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {minutes} min
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.groupLabel}>Alert {guardians} if I don't reply within</Text>
        <View style={styles.chipRow}>
          {NO_REPLY_OPTIONS.map((minutes) => {
            const selected = draft.noReplyMinutes === minutes;
            return (
              <TouchableOpacity
                key={minutes}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => setDraft((d) => ({ ...d, noReplyMinutes: minutes }))}
                activeOpacity={0.75}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${minutes} minute${minutes === 1 ? '' : 's'}`}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {minutes} min
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.fixedRule}>
          <Text style={styles.fixedRuleText}>
            When your battery drops under {draft.lowBatteryPercent}%, we send your last known
            location automatically.
          </Text>
        </View>

        <Button label="Save" variant="strong" onPress={() => onSave(draft)} style={styles.saveButton} />
        <Button label="Cancel" variant="ghost" onPress={onDismiss} />
      </ScrollView>
    </BottomSheet>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    title: {
      fontSize: 22,
      fontFamily: FONTS.headingXBold,
      color: theme.textPrimary,
      marginBottom: SPACING.xs,
    },
    subtitle: {
      fontSize: 15,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
      lineHeight: 21,
      marginBottom: SPACING.lg,
    },
    groupLabel: {
      fontSize: 15,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
      marginBottom: SPACING.sm,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
      marginBottom: SPACING.lg,
    },
    chip: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm + 2,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
    },
    chipSelected: {
      backgroundColor: theme.strong,
      borderColor: theme.strong,
    },
    chipText: {
      fontSize: 15,
      fontFamily: FONTS.bodySemibold,
      color: theme.textSecondary,
    },
    chipTextSelected: { color: theme.strongText },
    fixedRule: {
      padding: SPACING.lg,
      borderRadius: RADIUS.lg,
      backgroundColor: theme.background,
      marginBottom: SPACING.lg,
    },
    fixedRuleText: {
      fontSize: 14,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    saveButton: { marginBottom: SPACING.sm },
  });
}
