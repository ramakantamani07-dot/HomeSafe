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

import { useTheme } from '../../src/context/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../src/config/theme';
import { useAccountDeletion } from '../../src/hooks/useAccountDeletion';
import { Icon } from '../../src/components/ui/Icon';
import { Button } from '../../src/components/ui/Button';
import type { ThemeColors } from '../../src/config/theme';

export default function DeleteAccountScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
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
          <Icon name="warning" size={28} color={theme.critical.fg} />
          <Text style={styles.warningTitle}>This cannot be undone</Text>
          <Text style={styles.warningDesc}>
            Deleting your account permanently removes all your data from wayLoc. You
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
            <ActivityIndicator color={theme.accent} />
            <Text style={styles.progressText}>Verifying your identity…</Text>
          </View>
        )}

        {stage === 'deleting' && (
          <View style={styles.progressCard}>
            <ActivityIndicator color={theme.critical.fg} />
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
              placeholderTextColor={theme.textTertiary}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isWorking && !isBlocked}
            />

            <Button
              label="Delete My Account"
              onPress={handleDelete}
              disabled={!canDelete || isBlocked}
              variant="destructive"
              style={styles.deleteButton}
            />
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.background,
    },
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
    backButton: { width: 64 },
    backText: {
      fontSize: TYPOGRAPHY.body.fontSize,
      color: theme.accent,
      fontWeight: '600',
    },
    disabled: { opacity: 0.4 },
    screenTitle: {
      fontSize: TYPOGRAPHY.bodyStrong.fontSize,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    container: {
      padding: SPACING.lg,
      paddingBottom: SPACING.xxxl + 8,
    },
    sectionHeader: {
      fontSize: TYPOGRAPHY.caption.fontSize,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: SPACING.sm + 2,
      marginTop: SPACING.sm,
    },
    warningCard: {
      backgroundColor: theme.critical.bg,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: theme.critical.fg,
      padding: SPACING.lg,
      marginBottom: SPACING.xl,
      alignItems: 'center',
      gap: SPACING.sm,
    },
    warningTitle: {
      fontSize: TYPOGRAPHY.bodyStrong.fontSize,
      fontWeight: '700',
      color: theme.critical.fg,
    },
    warningDesc: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 19,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: SPACING.lg,
      marginBottom: SPACING.xl,
      gap: SPACING.sm,
    },
    bulletRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    bulletDot: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      color: theme.textSecondary,
      marginTop: 1,
    },
    bulletText: {
      flex: 1,
      fontSize: TYPOGRAPHY.callout.fontSize,
      color: theme.textPrimary,
      lineHeight: 20,
    },
    sosBlockCard: {
      backgroundColor: theme.warning.bg,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: theme.warning.fg,
      padding: SPACING.md + 2,
      marginBottom: SPACING.lg,
    },
    sosBlockText: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      color: theme.textPrimary,
      lineHeight: 19,
    },
    progressCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      backgroundColor: theme.surface,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: theme.border,
      padding: SPACING.md + 2,
      marginBottom: SPACING.lg,
    },
    progressText: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      color: theme.textSecondary,
    },
    errorCard: {
      backgroundColor: theme.critical.bg,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: theme.critical.fg,
      padding: SPACING.md + 2,
      marginBottom: SPACING.lg,
      gap: 6,
    },
    errorTitle: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      fontWeight: '700',
      color: theme.critical.fg,
    },
    errorText: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      color: theme.textPrimary,
      lineHeight: 19,
    },
    errorHint: {
      fontSize: TYPOGRAPHY.caption.fontSize,
      color: theme.textSecondary,
      lineHeight: 18,
      marginTop: 4,
    },
    confirmSection: {
      gap: SPACING.sm + 2,
    },
    confirmDesc: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      color: theme.textSecondary,
      lineHeight: 18,
      marginBottom: 2,
    },
    confirmWord: {
      fontWeight: '700',
      color: theme.textPrimary,
      fontFamily: 'monospace',
    },
    confirmInput: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.md,
      borderWidth: 1.5,
      borderColor: theme.border,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      fontSize: 16,
      color: theme.textPrimary,
      letterSpacing: 2,
      fontWeight: '600',
    },
    deleteButton: {
      marginTop: SPACING.xs,
    },
  });
}
