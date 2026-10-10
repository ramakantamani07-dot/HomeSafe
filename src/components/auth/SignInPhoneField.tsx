import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { ELEVATION, FIXED_PALETTES, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../../config/theme';
import {
  COUNTRIES,
  formatNational,
  maxNationalLength,
  nationalDigits,
  type Country,
} from '../../utils/phoneNumber';
import { BottomSheet } from '../ui/BottomSheet';
import { Icon } from '../ui/Icon';

const C = FIXED_PALETTES.signIn;
const FIELD_HEIGHT = 56;

interface Props {
  country: Country;
  onCountryChange: (country: Country) => void;
  /** National digits, trunk 0 removed; shown spaced for the country. */
  number: string;
  onNumberChange: (digits: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

/**
 * AN1's number row: a country chip and the number, spaced as it is typed
 * ("98765 43210"). Validation lives in `utils/phoneNumber`, shared with
 * `PhoneInput`; this is only the sign-in presentation of it.
 */
export function SignInPhoneField({
  country,
  onCountryChange,
  number,
  onNumberChange,
  onSubmit,
  disabled,
}: Props) {
  const theme = useTheme();
  const [picking, setPicking] = useState(false);
  const [focused, setFocused] = useState(false);
  const shown = formatNational(country, number);

  const handleChange = (text: string) => {
    const digits = nationalDigits(text);
    // Backspace over a space leaves the digits unchanged, and the space
    // would come straight back; take the digit before it instead.
    if (text.length < shown.length && digits === number) {
      onNumberChange(digits.slice(0, -1));
      return;
    }
    onNumberChange(digits);
  };

  return (
    <View style={styles.row}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Country: ${country.name}, ${country.dialCode}`}
        accessibilityHint="Changes the country code"
        style={styles.chip}
        onPress={() => setPicking(true)}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Text style={styles.flag}>{country.flag}</Text>
        <Text style={styles.dialCode}>{country.dialCode}</Text>
        <Icon name="chevronDown" size={14} color={C.textMuted} />
      </TouchableOpacity>

      <View style={[styles.field, focused && styles.fieldFocused]}>
        <TextInput
          style={styles.input}
          value={shown}
          onChangeText={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmit}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          // Room for a typed trunk 0 ("07700…") on top of the full number.
          maxLength={maxNationalLength(country) + 1}
          placeholder="Mobile number"
          placeholderTextColor={C.textMuted}
          selectionColor={C.brand}
          accessibilityLabel="Mobile number"
          editable={!disabled}
          autoFocus
        />
      </View>

      <BottomSheet visible={picking} onDismiss={() => setPicking(false)}>
        <Text style={[styles.pickerTitle, { color: theme.textPrimary }]}>Country</Text>
        {COUNTRIES.map((c) => {
          const selected = c.iso === country.iso;
          return (
            <TouchableOpacity
              key={c.iso}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.pickerRow, selected && { backgroundColor: theme.accentMuted }]}
              onPress={() => {
                onCountryChange(c);
                setPicking(false);
              }}
            >
              <Text style={styles.flag}>{c.flag}</Text>
              <Text style={[styles.pickerName, { color: theme.textPrimary }]}>{c.name}</Text>
              <Text style={[styles.pickerCode, { color: theme.textSecondary }]}>{c.dialCode}</Text>
            </TouchableOpacity>
          );
        })}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  chip: {
    height: FIELD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 14,
    paddingRight: SPACING.md,
    borderRadius: 18,
    backgroundColor: C.field,
    ...ELEVATION.xs,
  },
  flag: {
    fontSize: 20,
  },
  dialCode: {
    fontFamily: FONTS.bodySemibold,
    fontSize: 17,
    color: C.ink,
  },
  field: {
    flex: 1,
    height: FIELD_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: C.field,
    ...ELEVATION.xs,
  },
  fieldFocused: {
    borderColor: C.brand,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 4, color: C.focusRing }],
  },
  input: {
    fontFamily: FONTS.bodySemibold,
    fontSize: 19,
    letterSpacing: 0.5,
    color: C.ink,
    padding: 0,
  },
  pickerTitle: {
    ...TYPOGRAPHY.heading,
    fontFamily: FONTS.heading,
    marginBottom: SPACING.sm,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 2,
    minHeight: 48,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
  },
  pickerName: {
    flex: 1,
    fontSize: TYPOGRAPHY.body.fontSize,
    fontFamily: FONTS.body,
  },
  pickerCode: {
    fontSize: TYPOGRAPHY.callout.fontSize,
    fontFamily: FONTS.bodyMedium,
  },
});
