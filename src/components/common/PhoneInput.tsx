import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS } from '../../config/constants';

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
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.countryButton}
          onPress={() => setPickerOpen((v: boolean) => !v)}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={styles.flag}>{selectedCountry.flag}</Text>
          <Text style={styles.countryCode}>{selectedCountry.code}</Text>
          <Text style={styles.caret}>▾</Text>
        </TouchableOpacity>

        <TextInput
          style={[styles.input, disabled && styles.inputDisabled]}
          value={localNumber}
          onChangeText={handleNumberChange}
          keyboardType="phone-pad"
          placeholder="Phone number"
          placeholderTextColor={COLORS.textMuted}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          editable={!disabled}
          maxLength={15}
        />
      </View>

      {pickerOpen && (
        <View style={styles.picker}>
          {COUNTRY_CODES.map((c) => (
            <TouchableOpacity
              key={c.code}
              style={[
                styles.pickerItem,
                c.code === selectedCountry.code && styles.pickerItemActive,
              ]}
              onPress={() => handleCountrySelect(c)}
            >
              <Text style={styles.pickerFlag}>{c.flag}</Text>
              <Text style={styles.pickerName}>{c.name}</Text>
              <Text style={styles.pickerCode}>{c.code}</Text>
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
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRightWidth: 1.5,
    borderRightColor: COLORS.border,
    gap: 4,
  },
  flag: { fontSize: 20 },
  countryCode: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  caret: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginLeft: 2,
  },
  input: {
    flex: 1,
    fontSize: 17,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: COLORS.textPrimary,
  },
  inputDisabled: {
    color: COLORS.textMuted,
  },
  picker: {
    marginTop: 4,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  pickerItemActive: {
    backgroundColor: COLORS.primaryLight,
  },
  pickerFlag: { fontSize: 20 },
  pickerName: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  pickerCode: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});
