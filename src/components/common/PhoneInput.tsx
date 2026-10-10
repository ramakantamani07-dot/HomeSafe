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
import { deviceRegion } from '../../config/markets';
import { COUNTRIES, countryForRegion, type Country } from '../../utils/phoneNumber';

// Longest dial code first, so "+971" is matched before a shorter prefix.
const SORTED_CODES = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);

function parseE164(value: string): { country: Country; local: string } | null {
  if (!value.startsWith('+')) return null;
  for (const cc of SORTED_CODES) {
    if (value.startsWith(cc.dialCode)) {
      return { country: cc, local: value.slice(cc.dialCode.length) };
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
  const [selectedCountry, setSelectedCountry] = useState<Country>(
    () => parsed?.country ?? countryForRegion(deviceRegion()),
  );
  const [localNumber, setLocalNumber] = useState(parsed?.local ?? '');
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleNumberChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    setLocalNumber(digits);
    onPhoneChange(`${selectedCountry.dialCode}${digits}`);
  };

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setPickerOpen(false);
    onPhoneChange(`${country.dialCode}${localNumber}`);
  };

  return (
    <View>
      <View style={[styles.row, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <TouchableOpacity accessibilityRole="button"
          style={[styles.countryButton, { borderRightColor: theme.border }]}
          onPress={() => setPickerOpen((v: boolean) => !v)}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={styles.flag}>{selectedCountry.flag}</Text>
          <Text style={[styles.countryCode, { color: theme.textPrimary }]}>{selectedCountry.dialCode}</Text>
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
          {COUNTRIES.map((c) => (
            <TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: c.dialCode === selectedCountry.dialCode }}
              key={c.iso}
              style={[
                styles.pickerItem,
                c.dialCode === selectedCountry.dialCode && { backgroundColor: theme.accentMuted },
              ]}
              onPress={() => handleCountrySelect(c)}
            >
              <Text style={styles.pickerFlag}>{c.flag}</Text>
              <Text style={[styles.pickerName, { color: theme.textPrimary }]}>{c.name}</Text>
              <Text style={[styles.pickerCode, { color: theme.textSecondary }]}>{c.dialCode}</Text>
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
