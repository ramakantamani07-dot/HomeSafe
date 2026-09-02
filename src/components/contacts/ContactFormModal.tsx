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

import { COLORS } from '../../config/constants';
import {
  CONTACT_RELATIONSHIPS,
  type Contact,
  type ContactRelationship,
} from '../../models/Contact';
import { PhoneInput } from '../common/PhoneInput';

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
          style={styles.sheet}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>{isEdit ? 'Edit contact' : 'Add contact'}</Text>
            <TouchableOpacity onPress={onClose} disabled={saving}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Contact name"
              placeholderTextColor={COLORS.textMuted}
              returnKeyType="done"
              maxLength={60}
              editable={!saving}
            />

            <Text style={styles.label}>Phone number</Text>
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

            <Text style={styles.label}>Relationship</Text>
            <View style={styles.chips}>
              {CONTACT_RELATIONSHIPS.map((rel) => (
                <TouchableOpacity
                  key={rel}
                  style={[styles.chip, relationship === rel && styles.chipActive]}
                  onPress={() => setRelationship(rel)}
                  disabled={saving}
                >
                  <Text
                    style={[
                      styles.chipText,
                      relationship === rel && styles.chipTextActive,
                    ]}
                  >
                    {rel}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add contact'}
              </Text>
            </TouchableOpacity>

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
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 0,
    maxHeight: '90%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  cancel: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  chipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  chipText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.textMuted,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  bottomPad: {
    height: 24,
  },
});
