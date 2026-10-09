import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';

import { useTheme } from '../../src/context/ThemeContext';
import { SPACING, TYPOGRAPHY } from '../../src/config/theme';
import { usePrivacy } from '../../src/hooks/usePrivacy';
import { useDataExport } from '../../src/hooks/useDataExport';
import { useAuthContext } from '../../src/context/AuthContext';
import { useSOSContext } from '../../src/context/SOSContext';
import { useJourneyContext } from '../../src/context/JourneyContext';
import type { AppPermissionStatus } from '../../src/models/Permission';
import { PermissionExplainerModal } from '../../src/components/permissions/PermissionExplainerModal';
import { PinEntryModal } from '../../src/components/security/PinEntryModal';
import { Section, ListRow } from '../../src/components/ui/Section';
import { StatusBadge, type Severity } from '../../src/components/ui/StatusBadge';

function permissionSeverity(status: AppPermissionStatus): Severity {
  if (status === 'granted') return 'safe';
  if (status === 'denied') return 'warning';
  return 'neutral';
}

function permissionLabel(status: AppPermissionStatus): string {
  if (status === 'granted') return 'Granted';
  if (status === 'denied') return 'Denied';
  return 'Not requested';
}

export default function PrivacyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuthContext();
  const { activeSOS } = useSOSContext();
  const { activeJourney, deleteLocationHistory } = useJourneyContext();
  const {
    locationStatus,
    locationBackgroundStatus,
    notificationStatus,
    biometricAvailable,
    biometricLockEnabled,
    requestLocationPermission,
    requestNotificationPermission,
    enableBiometricLock,
    disableBiometricLock,
    duressCodeSet,
    setDuressCode,
    removeDuressCode,
  } = usePrivacy();
  const { stage: exportStage, exportMyData, reset: resetExport } = useDataExport();

  const [showLocationExplainer, setShowLocationExplainer] = useState(false);
  const [showNotificationExplainer, setShowNotificationExplainer] = useState(false);
  const [togglingBiometric, setTogglingBiometric] = useState(false);
  const [deletingHistory, setDeletingHistory] = useState(false);
  const [duressPinStage, setDuressPinStage] = useState<'idle' | 'new' | 'confirm'>('idle');
  const [duressPendingCode, setDuressPendingCode] = useState<string | null>(null);
  const [duressPinError, setDuressPinError] = useState<string | null>(null);

  const handleLocationAllow = async () => {
    setShowLocationExplainer(false);
    await requestLocationPermission();
  };

  const handleNotificationAllow = async () => {
    setShowNotificationExplainer(false);
    await requestNotificationPermission();
  };

  const handleBiometricToggle = async (value: boolean) => {
    setTogglingBiometric(true);
    try {
      if (value) {
        await enableBiometricLock();
      } else {
        await disableBiometricLock();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not change biometric setting.';
      Alert.alert('Biometric', msg);
    } finally {
      setTogglingBiometric(false);
    }
  };

  const openSystemSettings = () => Linking.openSettings();

  const startSetDuressCode = () => {
    setDuressPendingCode(null);
    setDuressPinError(null);
    setDuressPinStage('new');
  };

  const cancelDuressPinFlow = () => {
    setDuressPinStage('idle');
    setDuressPendingCode(null);
    setDuressPinError(null);
  };

  const handleDuressPinSubmit = async (pin: string) => {
    if (duressPinStage === 'new') {
      setDuressPendingCode(pin);
      setDuressPinError(null);
      setDuressPinStage('confirm');
      return;
    }
    // Confirm step
    if (pin !== duressPendingCode) {
      setDuressPinError("Codes didn't match — try again.");
      setDuressPendingCode(null);
      setDuressPinStage('new');
      return;
    }
    await setDuressCode(pin);
    cancelDuressPinFlow();
    Alert.alert(
      'Duress code set',
      'If you ever enter this code instead of resolving an SOS normally, it will look the same on your screen — but the alert stays active and your contacts keep being able to follow you.',
    );
  };

  const handleRemoveDuressCode = () => {
    Alert.alert(
      'Remove Duress Code',
      'You will no longer have a silent way to fake-resolve an SOS under duress.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => { void removeDuressCode(); } },
      ],
    );
  };

  // Android-only: OEM battery managers (MIUI, OneUI, EMUI, and stock Android's
  // own Doze/App Standby) frequently kill background location tracking even
  // when every official API has been used correctly — this is the standard,
  // OS-provided way to ask the user to exempt wayLoc from that. There's no
  // library-level way to check current status first (only to request), so
  // this always fires the system dialog rather than conditionally showing it.
  const requestBatteryOptimizationExemption = () => {
    const packageName = Constants.expoConfig?.android?.package;
    if (!packageName) return;
    IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
      { data: `package:${packageName}` },
    ).catch(() => {
      Alert.alert(
        'Could not open settings',
        'Please disable battery optimization for wayLoc manually from your device Settings.',
      );
    });
  };

  const handleExportData = async () => {
    const result = await exportMyData();
    if (!result.success && result.error) {
      Alert.alert('Export failed', result.error);
    }
    resetExport();
  };

  const handleDeleteJourneyHistory = () => {
    if (activeJourney) {
      Alert.alert('Journey Active', 'End your current journey before deleting history.');
      return;
    }
    if (activeSOS) {
      Alert.alert('SOS Active', 'Resolve the emergency before deleting history.');
      return;
    }
    Alert.alert(
      'Delete Journey History',
      'This removes the detailed GPS trail from all completed and cancelled journeys. Journey summaries (destination and dates) are kept. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete trails',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;
            setDeletingHistory(true);
            try {
              const result = await deleteLocationHistory();
              const msg =
                result.errors.length === 0
                  ? `Location trails deleted for ${result.processed} journey${result.processed !== 1 ? 's' : ''}.`
                  : `Deleted ${result.processed} journey trails. ${result.errors.length} could not be removed.`;
              Alert.alert('Done', msg);
            } catch {
              Alert.alert('Error', 'Could not delete journey history. Please try again.');
            } finally {
              setDeletingHistory(false);
            }
          },
        },
      ],
    );
  };

  const locationPress =
    locationStatus === 'undetermined'
      ? () => setShowLocationExplainer(true)
      : locationStatus === 'denied'
        ? openSystemSettings
        : undefined;

  const notificationPress =
    notificationStatus === 'undetermined'
      ? () => setShowNotificationExplainer(true)
      : notificationStatus === 'denied'
        ? openSystemSettings
        : undefined;

  const backgroundLocationPress = locationBackgroundStatus === 'denied' ? openSystemSettings : undefined;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={[styles.headerRow, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: theme.accent }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: theme.textPrimary }]}>Privacy & Security</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Section title="Permissions">
          <ListRow
            icon="location"
            title="Location Access"
            subtitle="Used to track your journey and share your whereabouts with trusted contacts."
            accessory={<StatusBadge label={permissionLabel(locationStatus)} severity={permissionSeverity(locationStatus)} />}
            onPress={locationPress}
          />
          <ListRow
            icon="compass"
            title='Background Location ("Always")'
            subtitle="Lets your trusted contacts keep following your journey even while wayLoc isn't open. You'll be asked for this the first time you start a journey — not here."
            accessory={<StatusBadge label={permissionLabel(locationBackgroundStatus)} severity={permissionSeverity(locationBackgroundStatus)} />}
            onPress={backgroundLocationPress}
          />
          {Platform.OS === 'android' && (
            <ListRow
              icon="battery"
              title="Battery Optimization"
              subtitle="Some phones aggressively stop apps running in the background to save power, which can interrupt journey tracking."
              value="Allow"
              onPress={requestBatteryOptimizationExemption}
            />
          )}
          <ListRow
            icon="notification"
            title="Notifications"
            subtitle="Safety alerts, check-in reminders, and emergency updates."
            accessory={<StatusBadge label={permissionLabel(notificationStatus)} severity={permissionSeverity(notificationStatus)} />}
            onPress={notificationPress}
          />
        </Section>

        <Section title="Your Data">
          <ListRow
            icon="eye"
            title="Who Can See My Data"
            subtitle="See exactly what each family connection is currently allowed to see about you."
            onPress={() => router.push('/(app)/data-visibility')}
          />
          <ListRow
            icon="lock"
            title="Stored on your device"
            subtitle="Your profile (name, phone), app preferences, and biometric settings are stored in your device's secure enclave. They never leave your device."
          />
          <ListRow
            icon="link"
            title="Stored in the cloud"
            subtitle="Journey records, GPS trails, check-in history, SOS events, trusted contacts, and your notification token are stored in Firebase (EU region) to enable real-time sharing during emergencies."
          />
          <ListRow
            icon="location"
            title="Location data"
            subtitle="Only collected while a journey or SOS is active. Never sold or shared with third parties."
          />
        </Section>

        <Section title="How long we keep data">
          <ListRow title="GPS trail — completed journeys" value="30 days" />
          <ListRow title="GPS trail — cancelled / missed journeys" value="7 days" />
          <ListRow title="GPS trail — journey with an unresolved SOS" value="Kept until resolved" />
          <ListRow title="SOS event records" value="90 days" />
          <ListRow title="Journey summaries (no GPS)" value="Until you delete them" />
          <ListRow title="Trusted contacts" value="Until you remove them" />
          <ListRow title="Account data" value="Until you delete your account" />
        </Section>

        <Section title="Manage your data">
          <ListRow
            icon="link"
            title="Download my data"
            subtitle="A JSON file with everything wayLoc has stored for you. Nothing is uploaded — this only reads what's already there."
            onPress={handleExportData}
            accessory={exportStage === 'exporting' ? <ActivityIndicator size="small" color={theme.textSecondary} /> : undefined}
          />
          <ListRow
            icon="trash"
            title="Delete journey location trails"
            subtitle="Removes the detailed GPS trail from all past journeys. Journey summaries are kept. Cannot be undone."
            onPress={handleDeleteJourneyHistory}
            accessory={deletingHistory ? <ActivityIndicator size="small" color={theme.textSecondary} /> : undefined}
          />
        </Section>

        <Section>
          <ListRow
            icon="trash"
            iconColor={theme.critical.fg}
            title="Delete Account"
            subtitle="Permanently removes your account and all associated data from wayLoc."
            destructive
            onPress={() => router.push('/(app)/delete-account')}
          />
        </Section>

        <Section title="Legal">
          <ListRow title="Privacy Policy" onPress={() => router.push('/(legal)/privacy-policy')} />
          <ListRow title="Terms of Service" onPress={() => router.push('/(legal)/terms')} />
        </Section>

        <Section title="Security">
          <ListRow
            icon="lock"
            title="Biometric Lock"
            subtitle={
              biometricAvailable
                ? 'Require fingerprint or Face ID each time wayLoc opens.'
                : 'Not available — enroll fingerprints or Face ID in your device settings first.'
            }
            accessory={
              <Switch
                value={biometricLockEnabled}
                onValueChange={handleBiometricToggle}
                disabled={!biometricAvailable || togglingBiometric}
                trackColor={{ false: theme.border, true: theme.accent }}
                thumbColor={theme.textOnColor}
              />
            }
          />
          <ListRow
            icon="shield"
            title="Duress Code"
            subtitle='A separate code for resolving an SOS under coercion. Looks like a normal "I am safe" resolve, but the alert stays active.'
            accessory={<StatusBadge label={duressCodeSet ? 'Set' : 'Not set'} severity={duressCodeSet ? 'safe' : 'neutral'} />}
            onPress={startSetDuressCode}
          />
        </Section>
        {duressCodeSet && (
          <TouchableOpacity accessibilityRole="button" onPress={handleRemoveDuressCode} style={styles.removeLinkWrap}>
            <Text style={[styles.removeLink, { color: theme.critical.fg }]}>Remove Duress Code</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <PermissionExplainerModal
        visible={showLocationExplainer}
        type="location"
        onAllow={handleLocationAllow}
        onDismiss={() => setShowLocationExplainer(false)}
      />

      <PermissionExplainerModal
        visible={showNotificationExplainer}
        type="notifications"
        onAllow={handleNotificationAllow}
        onDismiss={() => setShowNotificationExplainer(false)}
      />

      <PinEntryModal
        visible={duressPinStage !== 'idle'}
        title={duressPinStage === 'confirm' ? 'Confirm Duress Code' : 'Set Duress Code'}
        description={
          duressPinStage === 'confirm'
            ? 'Enter the same code again to confirm.'
            : 'Choose a 4–6 digit code you can enter under pressure without thinking. Make it different from any lock-screen PIN.'
        }
        confirmLabel={duressPinStage === 'confirm' ? 'Confirm' : 'Next'}
        errorText={duressPinError}
        onSubmit={handleDuressPinSubmit}
        onCancel={cancelDuressPinFlow}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 64,
  },
  backText: {
    fontSize: TYPOGRAPHY.body.fontSize,
    fontWeight: '600',
  },
  screenTitle: {
    fontSize: TYPOGRAPHY.bodyStrong.fontSize,
    fontWeight: '700',
  },
  container: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  removeLinkWrap: {
    alignItems: 'center',
    marginTop: -SPACING.sm,
    marginBottom: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  removeLink: {
    fontSize: TYPOGRAPHY.callout.fontSize,
    fontWeight: '600',
  },
});
