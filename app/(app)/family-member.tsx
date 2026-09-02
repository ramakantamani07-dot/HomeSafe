import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { COLORS } from '../../src/config/constants';
import { useFamily } from '../../src/hooks/useFamily';
import { FamilyStatusBadge } from '../../src/components/family/FamilyStatusBadge';
import {
  SHARING_MODE_LABELS,
  type FamilyPermissions,
  type SharingMode,
} from '../../src/models/Family';

const SHARING_MODES: SharingMode[] = [
  'SHARE_ALWAYS',
  'SHARE_DURING_JOURNEY',
  'NEVER_SHARE',
];

function formatLastSeen(date: Date | null): string {
  if (!date) return 'Unknown';
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} minutes ago`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `${hours} hours ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

function formatEta(eta: Date | null): string | null {
  if (!eta) return null;
  const diffMs = eta.getTime() - Date.now();
  if (diffMs <= 0) return 'Arriving now';
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return '?';
  if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase();
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase();
}

export default function FamilyMemberScreen() {
  const router = useRouter();
  const { connectionId } = useLocalSearchParams<{ connectionId: string }>();
  const { members, removeMember, updatePermissions } = useFamily();

  const member = members.find((m) => m.connectionId === connectionId);

  const [isRemoving, setIsRemoving] = useState(false);
  const [isSavingPerms, setIsSavingPerms] = useState(false);
  const [localPerms, setLocalPerms] = useState<FamilyPermissions | null>(
    member?.myPermissions ?? null,
  );

  if (!member) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Member not found.</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>← Back to Family</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const perms = localPerms ?? member.myPermissions;
  const batteryPct =
    member.batteryLevel != null ? Math.round(member.batteryLevel * 100) : null;
  const eta = formatEta(member.activeJourneyEta);

  const handleRemove = () => {
    Alert.alert(
      'Remove Family Member',
      `Remove ${member.displayName} from your family? They will no longer see your status.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsRemoving(true);
            try {
              await removeMember(connectionId);
              router.back();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to remove.');
              setIsRemoving(false);
            }
          },
        },
      ],
    );
  };

  const handleSavePermissions = async () => {
    if (!localPerms) return;
    setIsSavingPerms(true);
    try {
      await updatePermissions(connectionId, localPerms);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setIsSavingPerms(false);
    }
  };

  const updatePerm = <K extends keyof FamilyPermissions>(key: K, value: FamilyPermissions[K]) => {
    setLocalPerms((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  const permsDirty =
    localPerms !== null &&
    JSON.stringify(localPerms) !== JSON.stringify(member.myPermissions);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>{member.displayName}</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity card */}
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(member.displayName)}</Text>
          </View>
          <Text style={styles.memberName}>{member.displayName}</Text>
          <Text style={styles.memberPhone}>{member.phoneNumber}</Text>
          <Text style={styles.memberRelationship}>{member.relationship}</Text>
        </View>

        {/* Live status */}
        <Text style={styles.sectionHeader}>Live Status</Text>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <FamilyStatusBadge status={member.status} />
            <Text style={styles.lastSeen}>Last seen: {formatLastSeen(member.lastSeen)}</Text>
          </View>

          {batteryPct != null && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Battery</Text>
              <Text
                style={[
                  styles.infoValue,
                  batteryPct < 20
                    ? { color: COLORS.danger }
                    : batteryPct < 40
                      ? { color: COLORS.warning }
                      : { color: COLORS.success },
                ]}
              >
                {batteryPct}%
              </Text>
            </View>
          )}
        </View>

        {/* Active journey */}
        {member.activeJourneyId && member.activeJourneyDestination && (
          <>
            <Text style={styles.sectionHeader}>Active Journey</Text>
            <View style={[styles.card, styles.journeyCard]}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Destination</Text>
                <Text style={styles.infoValue} numberOfLines={2}>
                  {member.activeJourneyDestination}
                </Text>
              </View>
              {eta && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>ETA</Text>
                  <Text style={[styles.infoValue, { color: COLORS.primary }]}>{eta}</Text>
                </View>
              )}
              <View style={styles.roViewNote}>
                <Text style={styles.roViewNoteText}>
                  View only — you cannot edit another member's journey.
                </Text>
              </View>
            </View>
          </>
        )}

        {/* My sharing settings (what I share with them) */}
        <Text style={styles.sectionHeader}>What I Share with {member.displayName}</Text>
        <View style={styles.card}>
          <Text style={styles.permLabel}>Sharing Mode</Text>
          {SHARING_MODES.map((mode) => (
            <TouchableOpacity
              key={mode}
              style={styles.modeRow}
              onPress={() => updatePerm('sharingMode', mode)}
            >
              <View
                style={[
                  styles.radio,
                  perms.sharingMode === mode && styles.radioSelected,
                ]}
              />
              <Text style={styles.modeLabel}>{SHARING_MODE_LABELS[mode]}</Text>
            </TouchableOpacity>
          ))}

          <View style={styles.divider} />

          {/* Granular toggles — only meaningful when not NEVER_SHARE */}
          {perms.sharingMode !== 'NEVER_SHARE' && (
            <>
              {(
                [
                  ['shareLocation', 'Share location'],
                  ['shareJourneyDetails', 'Share journey details'],
                  ['shareBattery', 'Share battery level'],
                  ['shareStatus', 'Share status'],
                ] as [keyof FamilyPermissions, string][]
              ).map(([key, label]) => (
                <View key={key} style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>{label}</Text>
                  <Switch
                    value={perms[key] as boolean}
                    onValueChange={(v) => updatePerm(key, v)}
                    trackColor={{ true: COLORS.primary, false: COLORS.border }}
                    thumbColor={COLORS.white}
                  />
                </View>
              ))}
            </>
          )}

          {permsDirty && (
            <TouchableOpacity
              style={[styles.saveButton, isSavingPerms && { opacity: 0.5 }]}
              onPress={handleSavePermissions}
              disabled={isSavingPerms}
            >
              <Text style={styles.saveButtonText}>
                {isSavingPerms ? 'Saving…' : 'Save Sharing Settings'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Remove member */}
        <TouchableOpacity
          style={[styles.removeButton, isRemoving && { opacity: 0.5 }]}
          onPress={handleRemove}
          disabled={isRemoving}
        >
          <Text style={styles.removeButtonText}>
            {isRemoving ? 'Removing…' : `Remove ${member.displayName}`}
          </Text>
        </TouchableOpacity>
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
    marginBottom: 8,
    marginTop: 16,
  },
  identityCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 20,
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
  },
  memberName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  memberPhone: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  memberRelationship: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 14,
    gap: 10,
  },
  journeyCard: {
    borderColor: COLORS.primary + '50',
    backgroundColor: COLORS.primaryLight,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastSeen: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 2,
    textAlign: 'right',
  },
  roViewNote: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 8,
  },
  roViewNoteText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  permLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  radioSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  modeLabel: {
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  toggleLabel: {
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  removeButton: {
    marginTop: 24,
    borderWidth: 1.5,
    borderColor: COLORS.danger,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  removeButtonText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: '700',
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  notFoundText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  backLink: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
