import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
import { BottomSheet } from '../ui/BottomSheet';
import { Icon } from '../ui/Icon';
import { MODE_ICON } from './modeIcon';
import { TRAVEL_MODES, type TravelMode } from '../../models/Place';

interface ChangeTravelOptionsProps {
  current: TravelMode;
  /** Called once the change is saved, or when the current mode is chosen. */
  onDone(): void;
  /** Saves the new mode. Throws when it could not be saved. */
  onChange(mode: TravelMode): Promise<void>;
}

interface ChangeTravelSheetProps extends Omit<ChangeTravelOptionsProps, 'onDone'> {
  visible: boolean;
  onDismiss(): void;
}

/**
 * "Change travel" (rides.md, States): the auto never came, so walk or take a
 * cab instead — without ending the journey and starting again. The route, ETA
 * and checks follow the new mode; a new ride mode starts waiting afresh.
 */
export function ChangeTravelSheet({ visible, current, onDismiss, onChange }: ChangeTravelSheetProps) {
  return (
    <BottomSheet visible={visible} onDismiss={onDismiss}>
      <ChangeTravelOptions current={current} onDone={onDismiss} onChange={onChange} />
    </BottomSheet>
  );
}

/** The choices alone, for a sheet that is already open (journey Options). */
export function ChangeTravelOptions({ current, onDone, onChange }: ChangeTravelOptionsProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [saving, setSaving] = useState<TravelMode | null>(null);

  const choose = async (mode: TravelMode) => {
    if (mode === current) {
      onDone();
      return;
    }
    setSaving(mode);
    try {
      await onChange(mode);
      onDone();
    } catch {
      Alert.alert("Couldn't change travel", 'Check your connection and try again. Your journey is still on.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <View style={styles.content}>
      <Text style={styles.title}>How are you travelling now?</Text>
      <Text style={styles.body}>Your journey keeps running.</Text>
      <View style={styles.grid}>
        {TRAVEL_MODES.map(({ mode, label }) => {
          const selected = mode === current;
          return (
            <TouchableOpacity
              key={mode}
              onPress={() => void choose(mode)}
              disabled={saving !== null}
              style={[styles.option, selected && styles.optionSelected, saving === mode && styles.optionBusy]}
              accessibilityRole="button"
              accessibilityState={{ selected, busy: saving === mode }}
              accessibilityLabel={selected ? `${label}, current` : label}
            >
              <Icon name={MODE_ICON[mode]} size={20} color={selected ? theme.accent : theme.textPrimary} />
              <Text style={[styles.optionLabel, selected && { color: theme.accent }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    content: { gap: SPACING.md, paddingBottom: SPACING.md },
    title: {
      fontSize: 22,
      fontFamily: FONTS.headingXBold,
      color: theme.textPrimary,
    },
    body: {
      fontSize: 15,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
      marginTop: -SPACING.xs,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    option: {
      flexGrow: 1,
      minWidth: 96,
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceRaised,
    },
    optionSelected: {
      borderColor: theme.accent,
      backgroundColor: theme.accentMuted,
    },
    optionBusy: { opacity: 0.6 },
    optionLabel: {
      fontSize: 15,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
  });
}
