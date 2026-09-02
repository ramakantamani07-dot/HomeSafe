import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { COLORS } from '../../src/config/constants';
import { useFamily } from '../../src/hooks/useFamily';
import { PhoneInput } from '../../src/components/common/PhoneInput';
import { FAMILY_RELATIONSHIPS } from '../../src/models/Family';
import type { FamilyRelationship } from '../../src/models/Family';

export default function FamilyInviteScreen() {
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
        `An invitation has been sent to ${phone}. They can accept it when they open HomeSafe.`,
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
            Enter the phone number of a HomeSafe user you want to connect with.
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
        <Text style={[styles.label, { marginTop: 20 }]}>Your relationship to them</Text>
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
        <TouchableOpacity
          style={[styles.sendButton, isSending && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={isSending}
          activeOpacity={0.8}
        >
          {isSending ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.sendButtonText}>Send Invitation</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          Family members can only see your location and journey details based on
          the sharing settings you configure after connecting.
        </Text>
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
    padding: 20,
    paddingBottom: 48,
  },
  infoCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.primary,
    lineHeight: 19,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  relationshipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  relChip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  relChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  relChipText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  relChipTextSelected: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  errorCard: {
    backgroundColor: COLORS.dangerLight,
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.danger,
    lineHeight: 18,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  footerNote: {
    marginTop: 16,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
});
