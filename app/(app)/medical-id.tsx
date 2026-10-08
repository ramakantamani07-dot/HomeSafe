import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../src/context/ThemeContext';
import { useGoBack } from '../../src/hooks/useGoBack';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../src/config/theme';
import { useSafetyPreferences } from '../../src/context/SafetyPreferencesContext';
import { MEDICAL_NOTES_MAX_LENGTH } from '../../src/models/SafetyPreferences';
import { Button } from '../../src/components/ui/Button';

/**
 * Medical ID (`AI11`, Safety tools).
 *
 * Free text rather than a form of fixed fields. What matters varies enormously
 * — an allergy, a condition, a medication, a language, who to call first — and
 * a fixed form would quietly exclude whatever a particular person most needs
 * said.
 *
 * Stored on the device only, like the other safety preferences. It is not sent
 * to guardians and not written to Firestore: it exists to be read off this
 * screen by whoever is helping, and medical information is the last thing that
 * should be synced somewhere the user did not ask for.
 */
export default function MedicalIdScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const goBack = useGoBack();

  const { preferences, setPreferences } = useSafetyPreferences();
  const [notes, setNotes] = useState(preferences.medicalNotes);

  // The stored value arrives asynchronously; adopt it unless the user has
  // already started typing, which would otherwise be overwritten mid-edit.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setNotes(preferences.medicalNotes);
  }, [preferences.medicalNotes, touched]);

  const save = async () => {
    await setPreferences({ ...preferences, medicalNotes: notes.trim() });
    goBack();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Medical ID</Text>
          <Text style={styles.intro}>
            Anything someone helping you should know — allergies, conditions, medication,
            or a language you prefer.
          </Text>

          <TextInput
            style={styles.input}
            value={notes}
            onChangeText={(text) => {
              setTouched(true);
              setNotes(text);
            }}
            placeholder="e.g. Severe nut allergy. Asthma — inhaler in bag."
            placeholderTextColor={theme.textTertiary}
            multiline
            textAlignVertical="top"
            maxLength={MEDICAL_NOTES_MAX_LENGTH}
            accessibilityLabel="Medical information shown to whoever helps you"
          />

          <Text style={styles.counter}>
            {notes.length} / {MEDICAL_NOTES_MAX_LENGTH}
          </Text>

          <View style={styles.privacyNote}>
            <Text style={styles.privacyText}>
              Kept on this phone only. wayLoc does not send this to your circle or store it
              on our servers.
            </Text>
          </View>

          <Button label="Save" variant="strong" onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    flex: { flex: 1 },
    container: { padding: SPACING.lg, gap: SPACING.md },
    title: {
      fontSize: 28,
      fontFamily: FONTS.headingXBold,
      color: theme.textPrimary,
      letterSpacing: -0.5,
    },
    intro: {
      fontSize: 15,
      lineHeight: 21,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    input: {
      minHeight: 160,
      padding: SPACING.lg,
      borderRadius: RADIUS.lg,
      backgroundColor: theme.surface,
      fontSize: 16,
      lineHeight: 22,
      fontFamily: FONTS.body,
      color: theme.textPrimary,
    },
    counter: {
      alignSelf: 'flex-end',
      fontSize: 13,
      fontFamily: FONTS.body,
      color: theme.textTertiary,
    },
    privacyNote: {
      padding: SPACING.lg,
      borderRadius: RADIUS.lg,
      backgroundColor: theme.surfaceRaised,
    },
    privacyText: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
  });
}
