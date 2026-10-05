import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
import { Icon } from '../ui/Icon';

interface SearchRowProps {
  value: string;
  onChangeText(text: string): void;
  /** Expands the sheet to full height — the field does not open a new screen. */
  onFocus(): void;
  onClear(): void;
  /** Collapses back to half, keeping the typed text (spec §3B). */
  onCollapse(): void;
  isSearching: boolean;
  /** The "D" avatar beside the field, which opens Settings. */
  avatarInitial: string;
  onOpenSettings(): void;
  inputRef?: React.Ref<TextInput>;
}

/**
 * Home's search row — the "Where to?" field plus the Settings avatar
 * (Option 15 `AI1` / `AI2`).
 *
 * Tapping the field expands the *same* sheet rather than pushing a screen, so
 * this component is rendered pinned inside the sheet header and never
 * unmounts. That is what lets the typed text survive collapsing, which the
 * spec requires for five minutes.
 */
export function SearchRow({
  value,
  onChangeText,
  onFocus,
  onClear,
  onCollapse,
  isSearching,
  avatarInitial,
  onOpenSettings,
  inputRef,
}: SearchRowProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const hasText = value.length > 0;

  return (
    <View style={styles.row}>
      <View style={styles.field}>
        <Icon name="search" size={20} color={theme.textSecondary} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          placeholder="Where to?"
          placeholderTextColor={theme.textSecondary}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Where to? Search for a place, address or postcode"
        />
        {hasText ? (
          <TouchableOpacity
            onPress={onClear}
            style={styles.clear}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={HIT_SLOP}
          >
            <Icon name="close" size={14} color={theme.textSecondary} />
          </TouchableOpacity>
        ) : (
          <Icon name="mic" size={20} color={theme.textSecondary} />
        )}
      </View>

      {isSearching ? (
        <TouchableOpacity
          onPress={onCollapse}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close search"
          hitSlop={HIT_SLOP}
        >
          <Icon name="close" size={20} color={theme.textPrimary} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={onOpenSettings}
          accessibilityRole="button"
          accessibilityLabel="Settings and profile"
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarInitial}</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingHorizontal: SPACING.lg,
    },
    field: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      height: 52,
      paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.pill,
      backgroundColor: theme.background,
    },
    input: {
      flex: 1,
      fontSize: 17,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
      paddingVertical: 0,
    },
    clear: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.border,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentMuted,
    },
    avatarText: {
      fontSize: 17,
      fontFamily: FONTS.heading,
      color: theme.accent,
    },
    closeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
    },
  });
}
