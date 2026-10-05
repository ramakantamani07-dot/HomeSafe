import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../config/theme';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';

interface PinEntryModalProps {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  /** Shown under the input, e.g. a "wrong code" message. Cleared by the caller. */
  errorText?: string | null;
  onSubmit(pin: string): void;
  onCancel(): void;
}

export function PinEntryModal({
  visible,
  title,
  description,
  confirmLabel,
  errorText,
  onSubmit,
  onCancel,
}: PinEntryModalProps) {
  const theme = useTheme();
  const [pin, setPin] = useState('');

  // Start from a blank field every time the modal is (re)opened.
  useEffect(() => {
    if (visible) setPin('');
  }, [visible]);

  const canSubmit = /^\d{4,6}$/.test(pin);

  return (
    <BottomSheet visible={visible} onDismiss={onCancel}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text>

        <TextInput
          style={[
            styles.input,
            { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.background },
          ]}
          value={pin}
          onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          placeholder="••••"
          placeholderTextColor={theme.textTertiary}
          autoFocus
        />

        {errorText ? (
          <Text style={[styles.errorText, { color: theme.critical.fg }]}>{errorText}</Text>
        ) : null}

        <Button
          label={confirmLabel}
          onPress={() => onSubmit(pin)}
          disabled={!canSubmit}
          style={styles.confirmButton}
        />
        <Button label="Cancel" onPress={onCancel} variant="ghost" />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.heading.fontSize,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: SPACING.sm,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: TYPOGRAPHY.callout.fontSize,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.callout.lineHeight + 4,
    marginBottom: SPACING.lg,
  },
  input: {
    width: '100%',
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md + 2,
    marginBottom: SPACING.sm,
  },
  errorText: {
    fontSize: TYPOGRAPHY.callout.fontSize,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  confirmButton: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
});
