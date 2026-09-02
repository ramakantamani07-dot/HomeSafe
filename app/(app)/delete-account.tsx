import React from 'react';
import {
  ActivityIndicator,
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
import { useAccountDeletion } from '../../src/hooks/useAccountDeletion';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const {
    stage,
    confirmationText,
    setConfirmationText,
    canDelete,
    blockedByActiveJourney,
    blockedBySOS,
    error,
    requiresRecentAuth,
    initiateDelete,
  } = useAccountDeletion();

  const isWorking = stage === 'authenticating' || stage === 'deleting';
  const isBlocked = blockedByActiveJourney || blockedBySOS;

  const handleDelete = async () => {
    if (blockedByActiveJourney) {
      Alert.alert(
        'Journey Active',
        'End your current journey before deleting your account.',
      );
      return;
    }
    if (blockedBySOS) {
      Alert.alert(
        'SOS Active',
        'You cannot delete your account while an emergency SOS is active. Resolve the SOS first.',
      );
      return;
    }
    Alert.alert(
      'Delete Account',
      'This is permanent and cannot be undone. All your data will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: initiateDelete,
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          disabled={isWorking}
        >
          <Text style={[styles.backText, isWorking && styles.disabled]}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Delete Account</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Warning banner */}
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningTitle}>This cannot be undone</Text>
          <Text style={styles.warningDesc}>
            Deleting your account permanently removes all your data from HomeSafe. You
            will not be able to recover journeys, contacts, or SOS history.
          </Text>
        </View>

        {/* What gets deleted */}
        <Text style={styles.sectionHeader}>What will be deleted</Text>
        <View style={styles.card}>
          {[
            'Your phone number and profile',
            'All trusted contacts',
            'All journey records and GPS trails',
            'All check-in history',
            'All SOS event records',
            'Device notification token',
          ].map((item) => (
            <View key={item} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Journey / SOS block warnings */}
        {blockedByActiveJourney && (
          <View style={styles.sosBlockCard}>
            <Text style={styles.sosBlockText}>
              A journey is in progress. End your journey before deleting your account.
            </Text>
          </View>
        )}
        {blockedBySOS && (
          <View style={styles.sosBlockCard}>
            <Text style={styles.sosBlockText}>
              An active SOS is in progress. Resolve the emergency before deleting
              your account.
            </Text>
          </View>
        )}

        {/* Deletion progress / status */}
        {stage === 'authenticating' && (
          <View style={styles.progressCard}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.progressText}>Verifying your identity…</Text>
          </View>
        )}

        {stage === 'deleting' && (
          <View style={styles.progressCard}>
            <ActivityIndicator color={COLORS.danger} />
            <Text style={styles.progressText}>Deleting your account…</Text>
          </View>
        )}

        {stage === 'error' && error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Deletion failed</Text>
            <Text style={styles.errorText}>{error}</Text>
            {requiresRecentAuth && (
              <Text style={styles.errorHint}>
                Sign out and sign in again, then return to this screen.
              </Text>
            )}
          </View>
        )}

        {/* Confirmation input */}
        {!isWorking && stage !== 'done' && (
          <View style={styles.confirmSection}>
            <Text style={styles.sectionHeader}>Confirm deletion</Text>
            <Text style={styles.confirmDesc}>
              Type <Text style={styles.confirmWord}>DELETE</Text> to enable the button.
            </Text>
            <TextInput
              style={styles.confirmInput}
              value={confirmationText}
              onChangeText={setConfirmationText}
              placeholder="Type DELETE"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isWorking && !isBlocked}
            />

            <TouchableOpacity
              style={[
                styles.deleteButton,
                (!canDelete || isBlocked) && styles.deleteButtonDisabled,
              ]}
              onPress={handleDelete}
              disabled={!canDelete || isWorking || isBlocked}
              activeOpacity={0.8}
            >
              <Text style={styles.deleteButtonText}>Delete My Account</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
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
  backButton: { width: 64 },
  backText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  disabled: { opacity: 0.4 },
  screenTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  container: {
    padding: 16,
    paddingBottom: 48,
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
  warningCard: {
    backgroundColor: COLORS.danger + '12',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.danger + '40',
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
    gap: 8,
  },
  warningIcon: { fontSize: 28 },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.danger,
  },
  warningDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 20,
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bulletDot: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  sosBlockCard: {
    backgroundColor: COLORS.warning + '18',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.warning + '60',
    padding: 14,
    marginBottom: 16,
  },
  sosBlockText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 19,
  },
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  errorCard: {
    backgroundColor: COLORS.danger + '10',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.danger + '40',
    padding: 14,
    marginBottom: 16,
    gap: 6,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.danger,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 19,
  },
  errorHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginTop: 4,
  },
  confirmSection: {
    gap: 10,
  },
  confirmDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 2,
  },
  confirmWord: {
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontFamily: 'monospace',
  },
  confirmInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
    letterSpacing: 2,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  deleteButtonDisabled: {
    opacity: 0.35,
  },
  deleteButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
