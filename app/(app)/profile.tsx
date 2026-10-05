import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../src/context/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../src/config/theme';
import { useAuth } from '../../src/hooks/useAuth';
import { Button } from '../../src/components/ui/Button';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, signOut, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name ?? '');
  }, [user?.name]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim() });
      Alert.alert('Saved', 'Profile updated.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not save your profile.';
      Alert.alert('Save failed', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Profile</Text>

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
              <Text style={[styles.avatarText, { color: theme.textOnColor }]}>
                {name?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <TouchableOpacity>
              <Text style={[styles.changePhoto, { color: theme.accent }]}>
                Change photo (Phase 1-B)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Fields */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Full name</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary },
              ]}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={theme.textTertiary}
              returnKeyType="done"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Phone number</Text>
            <View
              style={[
                styles.readonlyInput,
                { backgroundColor: theme.background, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.readonlyText, { color: theme.textPrimary }]}>
                {user?.phone ?? '—'}
              </Text>
              <Text style={[styles.readonlyHint, { color: theme.safe.fg }]}>Verified via OTP</Text>
            </View>
          </View>

          <Button
            label={saving ? 'Saving…' : 'Save changes'}
            onPress={handleSave}
            loading={saving}
            style={styles.saveButton}
          />

          <Button label="Sign out" onPress={signOut} variant="secondary" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: { padding: SPACING.lg, paddingBottom: SPACING.xxxl },
  title: {
    fontSize: TYPOGRAPHY.title.fontSize,
    fontWeight: '800',
    marginBottom: SPACING.xxl,
    letterSpacing: -0.3,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
  },
  changePhoto: {
    fontSize: TYPOGRAPHY.body.fontSize,
    fontWeight: '600',
  },
  field: { marginBottom: SPACING.xl },
  label: {
    fontSize: TYPOGRAPHY.caption.fontSize,
    fontWeight: '600',
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md + 2,
    fontSize: 16,
  },
  readonlyInput: {
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md + 2,
  },
  readonlyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  readonlyHint: {
    fontSize: TYPOGRAPHY.caption.fontSize,
    marginTop: 2,
  },
  saveButton: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
});
