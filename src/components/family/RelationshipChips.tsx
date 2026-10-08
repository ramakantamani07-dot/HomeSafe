import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
import { THEY_ARE_MY, type TheyAreMy } from '../../models/Family';
import { Icon } from '../ui/Icon';

/** "Who is Priya to you?" — one choice from `THEY_ARE_MY` (decision F3). */
export function RelationshipChips({
  value,
  onChange,
}: {
  value: TheyAreMy | null;
  onChange(value: TheyAreMy): void;
}) {
  const theme = useTheme();
  const styles = getStyles(theme);
  return (
    <View style={styles.wrap}>
      {THEY_ARE_MY.map((option) => {
        const selected = value === option;
        return (
          <TouchableOpacity
            key={option}
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={() => onChange(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            {selected && <Icon name="check" size={14} color={theme.textOnColor} />}
            <Text style={[styles.label, selected && styles.labelSelected]}>{option}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      minHeight: 40,
      paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.pill,
      backgroundColor: theme.surface,
    },
    chipSelected: { backgroundColor: theme.accent },
    label: { fontSize: 15, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    labelSelected: { color: theme.textOnColor },
  });
}
