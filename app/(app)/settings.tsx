import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme, useThemeMode, type ThemeMode } from '../../src/context/ThemeContext';
import { ELEVATION, RADIUS, SPACING, TYPOGRAPHY } from '../../src/config/theme';
import { useAuth } from '../../src/hooks/useAuth';
import { Section, ListRow } from '../../src/components/ui/Section';
import { CheckInIntervalRow } from '../../src/components/settings/CheckInIntervalRow';
import { AlertRulesRows } from '../../src/components/settings/AlertRulesRows';
import { SosHoldRow } from '../../src/components/settings/SosHoldRow';
import { useSafetyPreferences } from '../../src/context/SafetyPreferencesContext';
import type { ThemeColors } from '../../src/config/theme';

const MODE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

function AppearancePicker() {
  const theme = useTheme();
  const { mode, setMode } = useThemeMode();
  const styles = getPickerStyles(theme);

  return (
    <View style={styles.row}>
      {MODE_OPTIONS.map((opt) => {
        const selected = mode === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.segment, selected && styles.segmentSelected]}
            onPress={() => setMode(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${opt.label} appearance`}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function getPickerStyles(theme: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: SPACING.xs,
      padding: SPACING.xs,
      margin: SPACING.md,
      marginTop: 0,
      backgroundColor: theme.background,
      borderRadius: RADIUS.md,
    },
    segment: {
      flex: 1,
      paddingVertical: SPACING.sm + 2,
      borderRadius: RADIUS.sm + 2,
      alignItems: 'center',
    },
    segmentSelected: {
      backgroundColor: theme.surface,
      ...ELEVATION.xs,
    },
    segmentText: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    segmentTextSelected: {
      color: theme.textPrimary,
    },
  });
}

export default function SettingsScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { preferences: { medicalNotes } } = useSafetyPreferences();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Settings</Text>

        <Section title="Appearance">
          <AppearancePicker />
        </Section>

        <Section title="Profile">
          <ListRow
            icon="call"
            title="Verified phone"
            subtitle={user?.phone ?? 'Signed in with phone OTP'}
          />
          <ListRow
            icon="person"
            title="Profile"
            subtitle={user?.name ? user.name : 'Name not added yet'}
            onPress={() => router.push('/(app)/profile')}
          />
        </Section>

        {/* Family & circle. family.tsx has existed since the four-tab layout
            but became unreachable when Phase 2 removed the tab bar — this is
            now the only way in. */}
        <Section title="Family & circle">
          <ListRow
            icon="people"
            title="Your circle"
            subtitle="Who can see your journeys, and whose you can see"
            onPress={() => router.push('/(app)/family')}
          />
          <ListRow
            icon="people"
            title="Emergency contacts"
            subtitle="Who gets called and alerted"
            onPress={() => router.push('/(app)/contacts')}
          />
        </Section>

        {/* Journeys. Spec §10: journey screens configure nothing, so the
            check-in interval every journey inherits is set here and only here. */}
        <Section title="Journeys">
          <CheckInIntervalRow />
          <AlertRulesRows />
          <ListRow
            icon="location"
            title="Saved places"
            subtitle="Home, Work and anywhere else you go often"
            onPress={() => router.push('/(app)/saved-places')}
          />
          <ListRow
            icon="eye"
            title="Who sees what"
            subtitle="What your circle can see, and for how long"
            onPress={() => router.push('/(app)/data-visibility')}
          />
        </Section>

        <Section title="Safety tools">
          <SosHoldRow />
          <ListRow
            icon="call"
            title="Fake call"
            subtitle="Set the caller name and delay"
            onPress={() => router.push('/(app)/fake-call-settings')}
          />
          <ListRow
            icon="shield"
            title="Medical ID"
            subtitle={
              medicalNotes
                ? 'Shown to whoever responds in an emergency'
                : 'Not set — allergies, conditions, medication'
            }
            onPress={() => router.push('/(app)/medical-id')}
          />
        </Section>

        <Section title="Privacy & consent">
          <ListRow
            icon="shield"
            title="Privacy & Security"
            subtitle="Permissions, biometric lock, and data settings"
            onPress={() => router.push('/(app)/privacy')}
          />
          <ListRow
            icon="lock"
            title="Local secure storage"
            subtitle="Session and profile preferences are stored on this device"
          />
        </Section>

        <Section title="Account">
          <ListRow
            icon="arrowBack"
            title="Sign out"
            subtitle="Clear the local session on this device"
            onPress={signOut}
            destructive
          />
        </Section>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: SPACING.lg, paddingBottom: SPACING.xxxl },
  title: {
    fontSize: TYPOGRAPHY.title.fontSize,
    fontWeight: '800',
    marginBottom: SPACING.xl,
    letterSpacing: -0.3,
  },
});
