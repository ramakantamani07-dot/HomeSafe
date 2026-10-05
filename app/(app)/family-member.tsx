import React, { useState } from 'react';
import {
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
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import type { ThemeColors } from '../../src/config/theme';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../src/config/theme';
import { useFamily } from '../../src/hooks/useFamily';
import { FamilyStatusBadge } from '../../src/components/family/FamilyStatusBadge';
import { Icon } from '../../src/components/ui/Icon';
import { Button } from '../../src/components/ui/Button';
import { Section, ListRow } from '../../src/components/ui/Section';
import { formatCoordinates } from '../../src/models/Journey';
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
  const theme = useTheme();
  const styles = getStyles(theme);
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
  const batteryColor =
    batteryPct != null && batteryPct < 20
      ? theme.critical.fg
      : batteryPct != null && batteryPct < 40
        ? theme.warning.fg
        : theme.textSecondary;
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
        {/* Identity */}
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(member.displayName)}</Text>
          </View>
          <Text style={styles.memberName}>{member.displayName}</Text>
          <Text style={styles.memberPhone}>{member.phoneNumber}</Text>
          <Text style={styles.memberRelationship}>{member.relationship}</Text>
        </View>

        {/* Live status */}
        <View style={styles.statusHeaderRow}>
          <FamilyStatusBadge status={member.status} />
          <Text style={styles.lastSeen}>Last seen: {formatLastSeen(member.lastSeen)}</Text>
        </View>

        <Section>
          {batteryPct != null && (
            <ListRow
              icon="battery"
              iconColor={batteryColor}
              title="Battery"
              value={`${batteryPct}%`}
            />
          )}
          {member.location && (
            <ListRow
              icon="location"
              title="Location"
              value={`${formatCoordinates(member.location)} · Open in Maps`}
              onPress={() => {
                const { latitude, longitude } = member.location!;
                Linking.openURL(`https://maps.google.com/?q=${latitude},${longitude}`);
              }}
            />
          )}
        </Section>

        {/* Active journey */}
        {member.activeJourneyId && member.activeJourneyDestination && (
          <>
            <Text style={styles.sectionHeader}>Active Journey</Text>
            <View style={[styles.card, { backgroundColor: theme.accentMuted, borderColor: theme.accent }]}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Destination</Text>
                <Text style={styles.infoValue} numberOfLines={2}>
                  {member.activeJourneyDestination}
                </Text>
              </View>
              {eta && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>ETA</Text>
                  <Text style={[styles.infoValue, { color: theme.accent }]}>{eta}</Text>
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
              accessibilityRole="radio"
              accessibilityState={{ checked: perms.sharingMode === mode }}
            >
              <View style={[styles.radio, perms.sharingMode === mode && styles.radioSelected]}>
                {perms.sharingMode === mode && <Icon name="check" size={12} color={theme.textOnColor} />}
              </View>
              <Text style={styles.modeLabel}>{SHARING_MODE_LABELS[mode]}</Text>
            </TouchableOpacity>
          ))}

          {/* Granular toggles — only meaningful when not NEVER_SHARE */}
          {perms.sharingMode !== 'NEVER_SHARE' && (
            <>
              <View style={styles.divider} />
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
                    trackColor={{ true: theme.accent, false: theme.border }}
                    thumbColor={theme.textOnColor}
                  />
                </View>
              ))}
            </>
          )}

          {permsDirty && (
            <Button
              label={isSavingPerms ? 'Saving…' : 'Save Sharing Settings'}
              onPress={handleSavePermissions}
              loading={isSavingPerms}
              style={styles.saveButton}
            />
          )}
        </View>

        {/* Remove member */}
        <Button
          label={isRemoving ? 'Removing…' : `Remove ${member.displayName}`}
          onPress={handleRemove}
          loading={isRemoving}
          variant="destructive"
          style={styles.removeButton}
        />
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
    screenTitle: {
      fontSize: TYPOGRAPHY.bodyStrong.fontSize,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    container: {
      padding: SPACING.lg,
      paddingBottom: SPACING.xxxl,
      gap: SPACING.md,
    },
    sectionHeader: {
      fontSize: TYPOGRAPHY.caption.fontSize,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    identityCard: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: SPACING.xl,
      alignItems: 'center',
      gap: 6,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.accentMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.xs,
    },
    avatarText: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.accent,
    },
    memberName: {
      fontSize: TYPOGRAPHY.heading.fontSize,
      fontWeight: '800',
      color: theme.textPrimary,
    },
    memberPhone: {
      fontSize: TYPOGRAPHY.body.fontSize,
      color: theme.textSecondary,
    },
    memberRelationship: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      color: theme.textTertiary,
    },
    statusHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    lastSeen: {
      fontSize: TYPOGRAPHY.caption.fontSize,
      color: theme.textTertiary,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: theme.border,
      padding: SPACING.md,
      gap: SPACING.sm,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: SPACING.sm,
    },
    infoLabel: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      color: theme.textSecondary,
      flex: 1,
    },
    infoValue: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      fontWeight: '600',
      color: theme.textPrimary,
      flex: 2,
      textAlign: 'right',
    },
    roViewNote: {
      backgroundColor: theme.background,
      borderRadius: RADIUS.sm,
      padding: SPACING.sm,
    },
    roViewNoteText: {
      fontSize: TYPOGRAPHY.caption.fontSize,
      color: theme.textTertiary,
      textAlign: 'center',
    },
    permLabel: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: SPACING.xs,
    },
    modeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingVertical: SPACING.xs,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: {
      borderColor: theme.accent,
      backgroundColor: theme.accent,
    },
    modeLabel: {
      fontSize: TYPOGRAPHY.body.fontSize,
      color: theme.textPrimary,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
      marginVertical: SPACING.sm,
    },
    toggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: SPACING.xs,
    },
    toggleLabel: {
      fontSize: TYPOGRAPHY.body.fontSize,
      color: theme.textPrimary,
    },
    saveButton: {
      marginTop: SPACING.sm,
    },
    removeButton: {
      marginTop: SPACING.md,
    },
    notFound: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.md,
    },
    notFoundText: {
      fontSize: TYPOGRAPHY.body.fontSize,
      color: theme.textSecondary,
    },
    backLink: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      color: theme.accent,
      fontWeight: '600',
    },
  });
}
