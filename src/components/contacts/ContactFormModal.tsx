import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../config/theme';
import {
  CONTACT_RELATIONSHIPS,
  type Contact,
  type ContactRelationship,
} from '../../models/Contact';
import { PhoneInput } from '../common/PhoneInput';
import { Button } from '../ui/Button';

export type ContactFormData = {
  name: string;
  phone: string;
  relationship: ContactRelationship;
};

interface ContactFormModalProps {
  visible: boolean;
  /** null → add mode; non-null → edit mode with pre-populated fields */
  contact: Contact | null;
  onClose: () => void;
  /** Receives validated form data; throw to show an error alert. */
  onSave: (data: ContactFormData) => Promise<void>;
}

export function ContactFormModal({
  visible,
  contact,
  onClose,
  onSave,
}: ContactFormModalProps) {
  const theme = useTheme();
  const isEdit = contact !== null;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState<ContactRelationship>('Family');
  const [saving, setSaving] = useState(false);
  // Incrementing this key on every open forces PhoneInput to remount so its
  // internal localNumber state can never outlive a single modal session.
  const [phoneKey, setPhoneKey] = useState(0);

  // Re-populate when the modal opens or the target contact changes.
  useEffect(() => {
    if (visible) {
      setName(contact?.name ?? '');
      setPhone(contact?.phone ?? '');
      setRelationship(contact?.relationship ?? 'Family');
      setSaving(false);
      setPhoneKey((k) => k + 1);
    }
  }, [visible, contact]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ name, phone, relationship });
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not save contact.';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.sheet, { backgroundColor: theme.surface }]}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>
              {isEdit ? 'Edit contact' : 'Add contact'}
            </Text>
            <TouchableOpacity onPress={onClose} disabled={saving}>
              <Text style={[styles.cancel, { color: theme.accent }]}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.label, { color: theme.textSecondary }]}>Full name</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.background, borderColor: theme.border, color: theme.textPrimary },
              ]}
              value={name}
              onChangeText={setName}
              placeholder="Contact name"
              placeholderTextColor={theme.textTertiary}
              returnKeyType="done"
              maxLength={60}
              editable={!saving}
            />

            <Text style={[styles.label, { color: theme.textSecondary }]}>Phone number</Text>
            {/*
              key forces remount when switching between contacts so that
              PhoneInput re-initialises from the new initialValue.
            */}
            <PhoneInput
              key={phoneKey}
              initialValue={contact?.phone}
              onPhoneChange={setPhone}
              disabled={saving}
            />

            <Text style={[styles.label, { color: theme.textSecondary }]}>Relationship</Text>
            <View style={styles.chips}>
              {CONTACT_RELATIONSHIPS.map((rel) => {
                const selected = relationship === rel;
                return (
                  <TouchableOpacity
                    key={rel}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? theme.accent : theme.border,
                        backgroundColor: selected ? theme.accentMuted : theme.background,
                      },
                    ]}
                    onPress={() => setRelationship(rel)}
                    disabled={saving}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: selected ? theme.accent : theme.textSecondary, fontWeight: selected ? '700' : '500' },
                      ]}
                    >
                      {rel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Button
              label={saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add contact'}
              onPress={handleSave}
              loading={saving}
              style={styles.saveButton}
            />

            <View style={styles.bottomPad} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: RADIUS.lg + 4,
    borderTopRightRadius: RADIUS.lg + 4,
    paddingHorizontal: SPACING.xl,
    paddingBottom: 0,
    maxHeight: '90%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    marginBottom: SPACING.xs,
  },
  title: {
    fontSize: TYPOGRAPHY.heading.fontSize,
    fontWeight: '700',
  },
  cancel: {
    fontSize: TYPOGRAPHY.body.fontSize,
    fontWeight: '600',
  },
  label: {
    fontSize: TYPOGRAPHY.caption.fontSize,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
    marginTop: SPACING.lg,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md + 2,
    fontSize: 16,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.md + 2,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: TYPOGRAPHY.callout.fontSize,
  },
  saveButton: {
    marginTop: SPACING.xl,
  },
  bottomPad: {
    height: SPACING.xl,
  },
});
