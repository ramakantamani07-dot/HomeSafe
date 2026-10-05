import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import {
  FEATURE_COLORS,
  FONTS,
  RADIUS,
  SPACING,
  identityColor,
  type ThemeColors,
} from '../../config/theme';
import { Icon } from '../ui/Icon';

interface MemberRowProps {
  id: string;
  name: string;
  /** "At home", "1.1 mi away", "Basic phone". */
  status: string;
  /**
   * App members get a call button; basic-phone members get Find, which is the
   * network-location lookup and is rate-limited and consent-gated behind it.
   */
  kind: 'app' | 'basic';
  onPress(): void;
  onAction(): void;
  /** Disables Find while a lookup is rate-limited — the reason is shown in `status`. */
  actionDisabled?: boolean;
}

/**
 * One person in Home's "Your circle" (Option 15 `AI1`).
 *
 * Handles both member kinds in one row because the design shows them in one
 * list. The storage behind them is deliberately separate — an app member is a
 * two-sided account connection, a basic-phone member has no account at all —
 * so this is the view-model seam where the two meet.
 */
export function MemberRow({
  id,
  name,
  status,
  kind,
  onPress,
  onAction,
  actionDisabled,
}: MemberRowProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  const avatarColor = kind === 'basic' ? FEATURE_COLORS.basicPhone : identityColor(theme, id);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${status}`}
    >
      <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
        <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
      </View>

      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.status} numberOfLines={1}>{status}</Text>
      </View>

      {kind === 'app' ? (
        <TouchableOpacity
          style={styles.callButton}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={`Call ${name}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="call" size={18} color={theme.safe.fg} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.findButton, actionDisabled && styles.findButtonDisabled]}
          onPress={onAction}
          disabled={actionDisabled}
          accessibilityRole="button"
          accessibilityLabel={
            actionDisabled ? `Finding ${name} is not available yet` : `Find ${name}`
          }
        >
          <Text style={[styles.findLabel, actionDisabled && styles.findLabelDisabled]}>Find</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.lg,
      minHeight: 64,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: theme.textOnColor,
      fontSize: 17,
      fontFamily: FONTS.heading,
    },
    text: { flex: 1, gap: 2 },
    name: {
      fontSize: 16,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
    status: {
      fontSize: 14,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    callButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.safe.bg,
    },
    findButton: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm + 2,
      borderRadius: RADIUS.pill,
      backgroundColor: theme.accentMuted,
      minHeight: 40,
      justifyContent: 'center',
    },
    findButtonDisabled: {
      backgroundColor: theme.border,
    },
    findLabel: {
      fontSize: 15,
      fontFamily: FONTS.bodySemibold,
      color: theme.accent,
    },
    findLabelDisabled: {
      color: theme.textSecondary,
    },
  });
}
