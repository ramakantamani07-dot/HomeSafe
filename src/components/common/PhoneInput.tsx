import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { ELEVATION, RADIUS, SPACING, TYPOGRAPHY } from '../../config/theme';

const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+1', flag: '🇺🇸', name: 'USA' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+60', flag: '🇲🇾', name: 'Malaysia' },
] as const;

type CountryCode = typeof COUNTRY_CODES[number];

// Sort longest-first so "+971" is matched before "+9" would be (if it existed).
const SORTED_CODES = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);

function parseE164(value: string): { country: CountryCode; local: string } | null {
  if (!value.startsWith('+')) return null;
  for (const cc of SORTED_CODES) {
    if (value.startsWith(cc.code)) {
      return { country: cc, local: value.slice(cc.code.length) };
    }
  }
  return null;
}

interface PhoneInputProps {
  /** Called with the full E.164 number on every change, e.g. "+919876543210" */
  onPhoneChange: (e164: string) => void;
  /** Pre-populate from an existing E.164 value (e.g. when editing a contact). */
  initialValue?: string;
  onSubmit?: () => void;
  disabled?: boolean;
}

export function PhoneInput({ onPhoneChange, initialValue, onSubmit, disabled }: PhoneInputProps) {
  const theme = useTheme();
  const parsed = initialValue ? parseE164(initialValue) : null;
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(parsed?.country ?? COUNTRY_CODES[0]);
  const [localNumber, setLocalNumber] = useState(parsed?.local ?? '');
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleNumberChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    setLocalNumber(digits);
    onPhoneChange(`${selectedCountry.code}${digits}`);
  };

  const handleCountrySelect = (country: CountryCode) => {
    setSelectedCountry(country);
    setPickerOpen(false);
    onPhoneChange(`${country.code}${localNumber}`);
  };

  return (
    <View>
      <View style={[styles.row, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <TouchableOpacity
          style={[styles.countryButton, { borderRightColor: theme.border }]}
          onPress={() => setPickerOpen((v: boolean) => !v)}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={styles.flag}>{selectedCountry.flag}</Text>
          <Text style={[styles.countryCode, { color: theme.textPrimary }]}>{selectedCountry.code}</Text>
          <Text style={[styles.caret, { color: theme.textSecondary }]}>▾</Text>
        </TouchableOpacity>

        <TextInput
          style={[styles.input, { color: disabled ? theme.textTertiary : theme.textPrimary }]}
          value={localNumber}
          onChangeText={handleNumberChange}
          keyboardType="phone-pad"
          placeholder="Phone number"
          placeholderTextColor={theme.textTertiary}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          editable={!disabled}
          maxLength={15}
        />
      </View>

      {pickerOpen && (
        <View
          style={[
            styles.picker,
            { backgroundColor: theme.surface, borderColor: theme.border },
            ELEVATION.float,
          ]}
        >
          {COUNTRY_CODES.map((c) => (
            <TouchableOpacity
              key={c.code}
              style={[
                styles.pickerItem,
                c.code === selectedCountry.code && { backgroundColor: theme.accentMuted },
              ]}
              onPress={() => handleCountrySelect(c)}
            >
              <Text style={styles.pickerFlag}>{c.flag}</Text>
              <Text style={[styles.pickerName, { color: theme.textPrimary }]}>{c.name}</Text>
              <Text style={[styles.pickerCode, { color: theme.textSecondary }]}>{c.code}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    borderRightWidth: 1.5,
    gap: 4,
  },
  flag: { fontSize: 20 },
  countryCode: {
    fontSize: TYPOGRAPHY.body.fontSize,
    fontWeight: '600',
  },
  caret: {
    fontSize: 10,
    marginLeft: 2,
  },
  input: {
    flex: 1,
    fontSize: 17,
    paddingHorizontal: SPACING.md + 2,
    paddingVertical: SPACING.lg,
  },
  picker: {
    marginTop: SPACING.xs,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm + 2,
  },
  pickerFlag: { fontSize: 20 },
  pickerName: {
    flex: 1,
    fontSize: TYPOGRAPHY.body.fontSize,
  },
  pickerCode: {
    fontSize: TYPOGRAPHY.callout.fontSize,
    fontWeight: '500',
  },
});
