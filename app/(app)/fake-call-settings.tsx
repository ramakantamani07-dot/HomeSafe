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

import { useTheme } from '../../src/context/ThemeContext';
import { FIXED_PALETTES, RADIUS, SPACING, TYPOGRAPHY } from '../../src/config/theme';
import { CALLER_LABELS, DELAY_OPTIONS } from '../../src/models/FakeCall';
import type { CallerLabel, DelaySeconds } from '../../src/models/FakeCall';
import { useFakeCall } from '../../src/hooks/useFakeCall';
import { useGoBack } from '../../src/hooks/useGoBack';
import { Button } from '../../src/components/ui/Button';
import type { ThemeColors } from '../../src/config/theme';

export default function FakeCallSettingsScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const goBack = useGoBack();
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
      goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity accessibilityRole="button" onPress={() => goBack()} style={styles.headerSide}>
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
            placeholderTextColor={theme.textTertiary}
            maxLength={40}
            returnKeyType="done"
            autoCorrect={false}
          />
        </View>

        {/* Caller label */}
        <Text style={styles.sectionLabel}>CALLER LABEL (OPTIONAL)</Text>
        <Text style={styles.sectionHint}>Shown below the name on the incoming call screen.</Text>
        <View style={styles.chipRow}>
          <TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: callerLabel === null }}
            style={[styles.chip, callerLabel === null && styles.chipSelected]}
            onPress={() => setCallerLabel(null)}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, callerLabel === null && styles.chipTextSelected]}>
              None
            </Text>
          </TouchableOpacity>
          {CALLER_LABELS.map((label) => (
            <TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: callerLabel === label }}
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
            <TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: delaySeconds === opt.value }}
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
        <Button
          label={saving ? 'Saving…' : 'Save Settings'}
          onPress={handleSave}
          loading={saving}
          style={styles.saveButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    headerSide: { width: 64 },
    backText: { fontSize: TYPOGRAPHY.body.fontSize, color: theme.accent, fontWeight: '600' },
    screenTitle: { fontSize: TYPOGRAPHY.bodyStrong.fontSize, fontWeight: '700', color: theme.textPrimary },
    container: { padding: SPACING.xl, paddingBottom: SPACING.xxxl },
    infoBanner: {
      backgroundColor: theme.accentMuted,
      borderRadius: RADIUS.md,
      padding: SPACING.md + 2,
      marginBottom: SPACING.xl,
      borderWidth: 1,
      borderColor: theme.accent,
    },
    infoText: { fontSize: TYPOGRAPHY.callout.fontSize, color: theme.accent, lineHeight: 19, fontWeight: '500' },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.textTertiary,
      letterSpacing: 1,
      marginBottom: SPACING.sm,
      marginTop: SPACING.xl,
    },
    sectionHint: { fontSize: TYPOGRAPHY.caption.fontSize, color: theme.textSecondary, marginBottom: SPACING.sm + 2, marginTop: -4 },
    inputCard: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.md,
      borderWidth: 1.5,
      borderColor: theme.border,
      paddingHorizontal: SPACING.lg,
      paddingVertical: 4,
    },
    textInput: {
      fontSize: 17,
      color: theme.textPrimary,
      paddingVertical: SPACING.md,
      fontWeight: '500',
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    chip: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm + 2,
      borderRadius: RADIUS.pill,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    chipSelected: {
      borderColor: theme.accent,
      backgroundColor: theme.accentMuted,
    },
    chipText: { fontSize: TYPOGRAPHY.callout.fontSize, fontWeight: '600', color: theme.textSecondary },
    chipTextSelected: { color: theme.accent },
    delayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    delayChip: {
      flex: 1,
      minWidth: 120,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.md,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: 'center',
    },
    previewCard: {
      backgroundColor: FIXED_PALETTES.fakeCall.background,
      borderRadius: RADIUS.lg,
      padding: SPACING.xl,
      alignItems: 'center',
      gap: 4,
    },
    previewName: { fontSize: 28, fontWeight: '800', color: FIXED_PALETTES.fakeCall.text },
    previewLabel: { fontSize: 15, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
    previewSub: { fontSize: TYPOGRAPHY.callout.fontSize, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
    saveButton: {
      marginTop: SPACING.xxl,
    },
  });
}
