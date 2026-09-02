import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { COLORS } from '../../src/config/constants';
import { CALLER_LABELS, DELAY_OPTIONS } from '../../src/models/FakeCall';
import type { CallerLabel, DelaySeconds } from '../../src/models/FakeCall';
import { useFakeCall } from '../../src/hooks/useFakeCall';

export default function FakeCallSettingsScreen() {
  const router = useRouter();
  const { settings, updateSettings } = useFakeCall();

  const [callerName, setCallerName] = useState(settings.callerName);
  const [callerLabel, setCallerLabel] = useState<CallerLabel | null>(settings.callerLabel);
  const [delaySeconds, setDelaySeconds] = useState<DelaySeconds>(settings.delaySeconds);
  const [saving, setSaving] = useState(false);

  // Sync local state if settings are loaded asynchronously after mount.
  useEffect(() => {
    setCallerName(settings.callerName);
    setCallerLabel(settings.callerLabel);
    setDelaySeconds(settings.delaySeconds);
  }, [settings]);

  const handleSave = async () => {
    const trimmed = callerName.trim();
    if (!trimmed) {
      Alert.alert('Caller name required', 'Please enter a name for your fake caller.');
      return;
    }
    setSaving(true);
    try {
      await updateSettings({ callerName: trimmed, callerLabel, delaySeconds });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerSide}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Fake Call Settings</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoText}>
            Configure a fake incoming call you can trigger discreetly to leave an uncomfortable situation.
          </Text>
        </View>

        {/* Caller name */}
        <Text style={styles.sectionLabel}>CALLER NAME</Text>
        <View style={styles.inputCard}>
          <TextInput
            style={styles.textInput}
            value={callerName}
            onChangeText={setCallerName}
            placeholder="e.g. Alex"
            placeholderTextColor={COLORS.textMuted}
            maxLength={40}
            returnKeyType="done"
            autoCorrect={false}
          />
        </View>

        {/* Caller label */}
        <Text style={styles.sectionLabel}>CALLER LABEL (OPTIONAL)</Text>
        <Text style={styles.sectionHint}>Shown below the name on the incoming call screen.</Text>
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, callerLabel === null && styles.chipSelected]}
            onPress={() => setCallerLabel(null)}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, callerLabel === null && styles.chipTextSelected]}>
              None
            </Text>
          </TouchableOpacity>
          {CALLER_LABELS.map((label) => (
            <TouchableOpacity
              key={label}
              style={[styles.chip, callerLabel === label && styles.chipSelected]}
              onPress={() => setCallerLabel(label)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, callerLabel === label && styles.chipTextSelected]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Delay */}
        <Text style={styles.sectionLabel}>CALL DELAY</Text>
        <Text style={styles.sectionHint}>
          How long to wait before the fake call appears.
        </Text>
        <View style={styles.delayGrid}>
          {DELAY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.delayChip, delaySeconds === opt.value && styles.chipSelected]}
              onPress={() => setDelaySeconds(opt.value)}
              activeOpacity={0.75}
            >
              <Text
                style={[styles.chipText, delaySeconds === opt.value && styles.chipTextSelected]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Preview */}
        <Text style={styles.sectionLabel}>PREVIEW</Text>
        <View style={styles.previewCard}>
          <Text style={styles.previewName}>{callerName.trim() || 'Caller Name'}</Text>
          {callerLabel && <Text style={styles.previewLabel}>{callerLabel}</Text>}
          <Text style={styles.previewSub}>Incoming call</Text>
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.buttonBusy]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save Settings'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  headerSide: { width: 64 },
  backText: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  screenTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  container: { padding: 20, paddingBottom: 48 },
  infoBanner: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  infoText: { fontSize: 13, color: COLORS.primary, lineHeight: 19, fontWeight: '500' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 20,
  },
  sectionHint: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 10, marginTop: -4 },
  inputCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  textInput: {
    fontSize: 17,
    color: COLORS.textPrimary,
    paddingVertical: 12,
    fontWeight: '500',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  chipText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  chipTextSelected: { color: COLORS.primary },
  delayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  delayChip: {
    flex: 1,
    minWidth: 120,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  previewCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 4,
  },
  previewName: { fontSize: 28, fontWeight: '800', color: COLORS.white },
  previewLabel: { fontSize: 15, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  previewSub: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  saveButton: {
    marginTop: 32,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: { color: COLORS.white, fontSize: 17, fontWeight: '700' },
  buttonBusy: { opacity: 0.6 },
});
