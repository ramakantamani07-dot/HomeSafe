import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../src/config/theme';
import { useFamily } from '../../src/hooks/useFamily';
import { PhoneInput } from '../../src/components/common/PhoneInput';
import { FAMILY_RELATIONSHIPS } from '../../src/models/Family';
import type { FamilyRelationship } from '../../src/models/Family';
import { Button } from '../../src/components/ui/Button';
import type { ThemeColors } from '../../src/config/theme';

export default function FamilyInviteScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();
  const { inviteMember } = useFamily();

  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState<FamilyRelationship>('Parent');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setError(null);
    setIsSending(true);
    try {
      await inviteMember(phone, relationship);
      Alert.alert(
        'Invitation Sent',
        `An invitation has been sent to ${phone}. They can accept it when they open wayLoc.`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          disabled={isSending}
        >
          <Text style={[styles.backText, isSending && styles.disabled]}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Invite Family Member</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Explanation */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Enter the phone number of a wayLoc user you want to connect with.
            They will receive a pending invitation and can accept or decline.
          </Text>
        </View>

        {/* Phone number */}
        <Text style={styles.label}>Their phone number</Text>
        <PhoneInput
          onPhoneChange={setPhone}
          disabled={isSending}
          onSubmit={handleSend}
        />

        {/* Relationship */}
        <Text style={[styles.label, { marginTop: SPACING.xl }]}>Your relationship to them</Text>
        <View style={styles.relationshipGrid}>
          {FAMILY_RELATIONSHIPS.map((rel) => (
            <TouchableOpacity
              key={rel}
              style={[
                styles.relChip,
                relationship === rel && styles.relChipSelected,
              ]}
              onPress={() => setRelationship(rel)}
              disabled={isSending}
            >
              <Text
                style={[
                  styles.relChipText,
                  relationship === rel && styles.relChipTextSelected,
                ]}
              >
                {rel}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Send button */}
        <Button
          label="Send Invitation"
          onPress={handleSend}
          loading={isSending}
          style={styles.sendButton}
        />

        <Text style={styles.footerNote}>
          Family members can only see your location and journey details based on
          the sharing settings you configure after connecting.
        </Text>
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
      padding: SPACING.xl,
      paddingBottom: SPACING.xxxl,
    },
    infoCard: {
      backgroundColor: theme.accentMuted,
      borderRadius: RADIUS.md,
      padding: SPACING.md + 2,
      marginBottom: SPACING.xl,
    },
    infoText: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      color: theme.accent,
      lineHeight: 19,
    },
    label: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: SPACING.sm,
    },
    relationshipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    relChip: {
      borderRadius: RADIUS.pill,
      paddingHorizontal: SPACING.md + 2,
      paddingVertical: SPACING.sm,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    relChipSelected: {
      borderColor: theme.accent,
      backgroundColor: theme.accentMuted,
    },
    relChipText: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    relChipTextSelected: {
      color: theme.accent,
      fontWeight: '700',
    },
    errorCard: {
      backgroundColor: theme.critical.bg,
      borderRadius: RADIUS.sm + 2,
      padding: SPACING.md,
      marginTop: SPACING.md + 2,
    },
    errorText: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      color: theme.critical.fg,
      lineHeight: 18,
    },
    sendButton: {
      marginTop: SPACING.xl,
    },
    footerNote: {
      marginTop: SPACING.lg,
      fontSize: 12,
      color: theme.textTertiary,
      textAlign: 'center',
      lineHeight: 17,
    },
  });
}
