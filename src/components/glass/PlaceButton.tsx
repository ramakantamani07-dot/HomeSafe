import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, SPACING, type ThemeColors } from '../../config/theme';
import { Icon, type IconName } from '../ui/Icon';
import type { SavedPlaceKind } from '../../models/Place';

const KIND_ICON: Record<SavedPlaceKind, IconName> = {
  home: 'home',
  work: 'briefcase',
  school: 'school',
  custom: 'location',
};

interface PlaceButtonProps {
  name: string;
  kind: SavedPlaceKind;
  /** "24 min" when a route estimate exists; "Add" for the empty slot. */
  caption?: string | null;
  /** Renders the dashed "+ Add" affordance instead of a saved place. */
  isAddSlot?: boolean;
  onPress(): void;
}

/**
 * One saved place in Home's places row (Option 15 `AI1`).
 *
 * Caption is optional and nullable rather than defaulted: a place whose ETA
 * hasn't resolved shows its name alone. Rendering "—" or "0 min" there would
 * be claiming a travel time we don't have, which §1 principle 4 rules out.
 */
export function PlaceButton({ name, kind, caption, isAddSlot, onPress }: PlaceButtonProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <TouchableOpacity
      style={styles.wrap}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={
        isAddSlot ? 'Add a place' : caption ? `${name}, about ${caption}` : `Go to ${name}`
      }
    >
      <View style={[styles.circle, isAddSlot && styles.circleAdd]}>
        <Icon
          name={isAddSlot ? 'add' : KIND_ICON[kind]}
          size={22}
          color={isAddSlot ? theme.textSecondary : theme.accent}
        />
      </View>
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
      {caption ? (
        <Text style={styles.caption} numberOfLines={1}>{caption}</Text>
      ) : (
        // Reserves the caption's line so the row's baselines stay aligned
        // whether or not an ETA has resolved yet.
        <Text style={styles.caption}> </Text>
      )}
    </TouchableOpacity>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      alignItems: 'center',
      gap: SPACING.xs,
      minWidth: 72,
    },
    circle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
    },
    circleAdd: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: theme.border,
    },
    name: {
      fontSize: 14,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
    caption: {
      fontSize: 12,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
  });
}
