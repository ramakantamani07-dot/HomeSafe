import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
import { ListRow } from '../ui/Section';
import type { IconName } from '../ui/Icon';

export interface Choice<T> {
  label: string;
  value: T;
}

interface ChoiceRowProps<T> {
  icon?: IconName;
  title: string;
  subtitle?: string;
  choices: Array<Choice<T>>;
  value: T;
  onChange(value: T): void;
}

/**
 * A settings row whose value is one of a short list.
 *
 * Expands in place rather than pushing a screen or opening a modal: these lists
 * are three or four items, and a whole screen to choose between "2, 3 or 5
 * seconds" costs the user two navigations to change one number. Collapsing on
 * selection keeps the Settings sheet scannable.
 */
export function ChoiceRow<T extends string | number | null>({
  icon,
  title,
  subtitle,
  choices,
  value,
  onChange,
}: ChoiceRowProps<T>) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [open, setOpen] = useState(false);

  const current = choices.find((c) => c.value === value);

  return (
    <>
      <ListRow
        icon={icon}
        title={title}
        subtitle={subtitle}
        value={current?.label ?? '—'}
        onPress={() => setOpen((o) => !o)}
        accessibilityLabel={`${title}. Currently ${current?.label ?? 'not set'}. Opens the options.`}
      />
      {open && (
        <View style={styles.options}>
          {choices.map((choice) => {
            const selected = choice.value === value;
            return (
              <Pressable
                key={String(choice.value)}
                onPress={() => {
                  onChange(choice.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [
                  styles.chip,
                  selected && styles.chipSelected,
                  pressed && styles.chipPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={choice.label}
              >
                <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                  {choice.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    options: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.md,
    },
    chip: {
      paddingHorizontal: SPACING.lg,
      height: 40,
      borderRadius: RADIUS.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceRaised,
    },
    chipSelected: {
      backgroundColor: theme.accent,
    },
    chipPressed: {
      opacity: 0.85,
    },
    chipLabel: {
      fontSize: 15,
      fontFamily: FONTS.heading,
      color: theme.textPrimary,
    },
    chipLabelSelected: {
      color: theme.textOnColor,
    },
  });
}
