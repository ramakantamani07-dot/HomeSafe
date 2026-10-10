import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FIXED_PALETTES, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../../config/theme';
import { Icon, type IconName } from './Icon';

// 'strong' is the design's main CTA: a solid ink pill ("Start journey",
// "Save place", "Done", "Continue"). 'primary' stays the teal accent fill for
// affirmative actions that aren't the page's single main commitment.
// 'brand' is the logo gradient, used only on sign-in (boards AN1–AN4).
export type ButtonVariant =
  | 'strong'
  | 'brand'
  | 'primary'
  | 'secondary'
  | 'destructive'
  | 'safe'
  | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

// One consistent large touch target across the whole app — 52pt height
// clears the 44pt minimum with room for larger Dynamic Type labels.
const MIN_HEIGHT = 52;

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  accessibilityHint,
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const { container, text, spinnerColor } = variantStyles(theme, variant, isDisabled);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityHint={accessibilityHint}
      style={[
        styles.base,
        container,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <View style={styles.content}>
          {icon && <Icon name={icon} size={18} color={text.color} />}
          <Text style={[styles.label, text]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function variantStyles(
  theme: ReturnType<typeof useTheme>,
  variant: ButtonVariant,
  isDisabled: boolean,
) {
  switch (variant) {
    case 'brand': {
      const brand = FIXED_PALETTES.signIn;
      return {
        container: isDisabled
          ? { backgroundColor: brand.disabled }
          : { backgroundColor: brand.brand, experimental_backgroundImage: brand.buttonGradient },
        text: { color: brand.onBrand },
        spinnerColor: brand.onBrand,
      };
    }
    case 'strong':
      return {
        container: { backgroundColor: isDisabled ? theme.borderStrong : theme.strong },
        text: { color: theme.strongText },
        spinnerColor: theme.strongText,
      };
    case 'primary':
      return {
        container: { backgroundColor: isDisabled ? theme.borderStrong : theme.accent },
        text: { color: theme.textOnColor },
        spinnerColor: theme.textOnColor,
      };
    case 'destructive':
      return {
        container: { backgroundColor: isDisabled ? theme.borderStrong : theme.critical.fg },
        text: { color: theme.textOnColor },
        spinnerColor: theme.textOnColor,
      };
    case 'safe':
      return {
        container: { backgroundColor: isDisabled ? theme.borderStrong : theme.safe.fg },
        text: { color: theme.textOnColor },
        spinnerColor: theme.textOnColor,
      };
    case 'secondary':
      return {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: theme.border,
        },
        text: { color: theme.textPrimary },
        spinnerColor: theme.textPrimary,
      };
    case 'ghost':
      return {
        container: { backgroundColor: 'transparent' },
        text: { color: theme.accent },
        spinnerColor: theme.accent,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_HEIGHT,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.7,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  label: {
    fontSize: TYPOGRAPHY.bodyStrong.fontSize,
    fontFamily: FONTS.bodySemibold,
  },
});
