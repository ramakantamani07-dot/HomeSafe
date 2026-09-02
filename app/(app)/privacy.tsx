import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { COLORS } from '../../src/config/constants';
import { usePrivacy } from '../../src/hooks/usePrivacy';
import { useAuthContext } from '../../src/context/AuthContext';
import { useSOSContext } from '../../src/context/SOSContext';
import { useJourneyContext } from '../../src/context/JourneyContext';
import { journeyService } from '../../src/context/AppProviders';
import type { AppPermissionStatus } from '../../src/models/Permission';
import { PermissionExplainerModal } from '../../src/components/permissions/PermissionExplainerModal';

function statusLabel(status: AppPermissionStatus): string {
  if (status === 'granted') return 'Granted';
  if (status === 'denied') return 'Denied';
  return 'Not requested';
}

function statusColor(status: AppPermissionStatus): string {
  if (status === 'granted') return COLORS.success;
  if (status === 'denied') return COLORS.danger;
  return COLORS.textMuted;
}

function StatusBadge({ status }: { status: AppPermissionStatus }) {
  return (
    <View style={[styles.badge, { backgroundColor: statusColor(status) + '1A' }]}>
      <Text style={[styles.badgeText, { color: statusColor(status) }]}>
        {statusLabel(status)}
      </Text>
    </View>
  );
}

export default function PrivacyScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { activeSOS } = useSOSContext();
  const { activeJourney } = useJourneyContext();
  const {
    locationStatus,
    notificationStatus,
    biometricAvailable,
    biometricLockEnabled,
    requestLocationPermission,
    requestNotificationPermission,
    enableBiometricLock,
    disableBiometricLock,
  } = usePrivacy();

  const [showLocationExplainer, setShowLocationExplainer] = useState(false);
  const [showNotificationExplainer, setShowNotificationExplainer] = useState(false);
  const [togglingBiometric, setTogglingBiometric] = useState(false);
  const [deletingHistory, setDeletingHistory] = useState(false);

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
              const result = await journeyService.deleteJourneyHistory(user.id);
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Privacy & Security</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── Permissions ── */}
        <Text style={styles.sectionHeader}>Permissions</Text>

        {/* Location */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardIcon}>📍</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Location Access</Text>
              <Text style={styles.cardDesc}>Used to track your journey and share your whereabouts with trusted contacts.</Text>
              <StatusBadge status={locationStatus} />
            </View>
          </View>

          {locationStatus === 'undetermined' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowLocationExplainer(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>Request Access</Text>
            </TouchableOpacity>
          )}
          {locationStatus === 'denied' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary]}
              onPress={openSystemSettings}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionButtonText, styles.actionButtonSecondaryText]}>
                Open Settings
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Background Location — placeholder */}
        <View style={[styles.card, styles.cardMuted]}>
          <View style={styles.cardRow}>
            <Text style={styles.cardIcon}>🗺️</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Background Location</Text>
              <Text style={styles.cardDesc}>Will be needed when the Journey feature is available. Not required yet.</Text>
              <View style={[styles.badge, { backgroundColor: COLORS.border }]}>
                <Text style={[styles.badgeText, { color: COLORS.textMuted }]}>
                  Coming with Journey
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardIcon}>🔔</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Notifications</Text>
              <Text style={styles.cardDesc}>Safety alerts, check-in reminders, and emergency updates.</Text>
              <StatusBadge status={notificationStatus} />
            </View>
          </View>

          {notificationStatus === 'undetermined' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowNotificationExplainer(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>Request Access</Text>
            </TouchableOpacity>
          )}
          {notificationStatus === 'denied' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary]}
              onPress={openSystemSettings}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionButtonText, styles.actionButtonSecondaryText]}>
                Open Settings
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Your Data ── */}
        <Text style={styles.sectionHeader}>Your Data</Text>

        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardIcon}>🔒</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Stored on your device</Text>
              <Text style={styles.cardDesc}>
                Your profile (name, phone), app preferences, and biometric settings are stored
                in your device's secure enclave (SecureStore). They never leave your device.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardIcon}>☁️</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Stored in the cloud</Text>
              <Text style={styles.cardDesc}>
                Journey records, GPS trails, check-in history, SOS events, trusted contacts,
                and your notification token are stored in Firebase (EU region) to enable
                real-time sharing with your trusted contacts during emergencies.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardIcon}>📍</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Location data</Text>
              <Text style={styles.cardDesc}>
                GPS coordinates are only collected while a journey or SOS is active.
                Background location is used during active journeys so your contacts
                can see your progress even when the app is not in the foreground.
                Location data is never sold or shared with third parties.
              </Text>
            </View>
          </View>
        </View>

        {/* ── Retention ── */}
        <Text style={styles.sectionHeader}>How long we keep data</Text>

        <View style={styles.card}>
          {[
            { label: 'GPS trail — completed journeys', value: '30 days' },
            { label: 'GPS trail — cancelled / missed journeys', value: '7 days' },
            { label: 'SOS event records', value: '90 days' },
            { label: 'Journey summaries (no GPS)', value: 'Until you delete them' },
            { label: 'Trusted contacts', value: 'Until you remove them' },
            { label: 'Account data', value: 'Until you delete your account' },
          ].map(({ label, value }) => (
            <View key={label} style={styles.retentionRow}>
              <Text style={styles.retentionLabel}>{label}</Text>
              <Text style={styles.retentionValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* ── Data Actions ── */}
        <Text style={styles.sectionHeader}>Manage your data</Text>

        <View style={styles.card}>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Delete journey location trails</Text>
            <Text style={styles.cardDesc}>
              Removes the detailed GPS trail from all past journeys. Journey summaries
              (destination and dates) are kept. Cannot be undone.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary, deletingHistory && styles.actionButtonDisabled]}
            onPress={handleDeleteJourneyHistory}
            disabled={deletingHistory}
            activeOpacity={0.8}
          >
            {deletingHistory ? (
              <ActivityIndicator size="small" color={COLORS.textSecondary} />
            ) : (
              <Text style={[styles.actionButtonText, styles.actionButtonSecondaryText]}>
                Delete Location Trails
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.card, styles.dangerCard]}
          onPress={() => router.push('/(app)/delete-account')}
          activeOpacity={0.8}
        >
          <View style={styles.cardRow}>
            <Text style={styles.cardIcon}>🗑️</Text>
            <View style={styles.cardBody}>
              <Text style={[styles.cardTitle, styles.dangerText]}>Delete Account</Text>
              <Text style={styles.cardDesc}>
                Permanently removes your account and all associated data from HomeSafe.
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
        </TouchableOpacity>

        {/* ── Security ── */}
        <Text style={styles.sectionHeader}>Security</Text>

        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardIcon}>🔐</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Biometric Lock</Text>
              <Text style={styles.cardDesc}>
                {biometricAvailable
                  ? 'Require fingerprint or Face ID each time HomeSafe opens.'
                  : 'Not available — enroll fingerprints or Face ID in your device settings first.'}
              </Text>
            </View>
            <Switch
              value={biometricLockEnabled}
              onValueChange={handleBiometricToggle}
              disabled={!biometricAvailable || togglingBiometric}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor={COLORS.white}
            />
          </View>
        </View>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
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
  backButton: {
    width: 64,
  },
  backText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  screenTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 8,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
  },
  cardMuted: {
    opacity: 0.65,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardIcon: {
    fontSize: 24,
    marginTop: 2,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  cardDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  actionButton: {
    marginTop: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  actionButtonSecondaryText: {
    color: COLORS.textSecondary,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  retentionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  retentionLabel: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  retentionValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'right',
  },
  dangerCard: {
    borderColor: COLORS.danger + '40',
  },
  dangerText: {
    color: COLORS.danger,
  },
  chevron: {
    fontSize: 20,
    color: COLORS.textMuted,
    alignSelf: 'center',
  },
});
