import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { FamilyMember } from '../../models/Family';
import { COLORS } from '../../config/constants';
import { FamilyStatusBadge } from './FamilyStatusBadge';

function formatEta(eta: Date | null): string | null {
  if (!eta) return null;
  const now = new Date();
  const diffMs = eta.getTime() - now.getTime();
  if (diffMs <= 0) return 'Arriving now';
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatLastSeen(date: Date | null): string {
  if (!date) return 'Unknown';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return '?';
  if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase();
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase();
}

interface FamilyMemberCardProps {
  member: FamilyMember;
  onPress?: () => void;
}

export function FamilyMemberCard({ member, onPress }: FamilyMemberCardProps) {
  const eta = member.activeJourneyEta ? formatEta(member.activeJourneyEta) : null;
  const batteryPct =
    member.batteryLevel != null ? Math.round(member.batteryLevel * 100) : null;

  const batteryColor =
    batteryPct != null && batteryPct < 20
      ? COLORS.danger
      : batteryPct != null && batteryPct < 40
        ? COLORS.warning
        : COLORS.success;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      accessibilityRole="button"
      accessibilityLabel={`${member.displayName}, ${member.relationship}`}
    >
      {/* Avatar + name row */}
      <View style={styles.headerRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(member.displayName)}</Text>
        </View>

        <View style={styles.nameBlock}>
          <Text style={styles.name} numberOfLines={1}>{member.displayName}</Text>
          <Text style={styles.relationship}>{member.relationship}</Text>
        </View>

        {/* Battery badge */}
        {batteryPct != null && (
          <View style={[styles.batteryBadge, { borderColor: batteryColor }]}>
            <Text style={[styles.batteryText, { color: batteryColor }]}>
              {batteryPct}%
            </Text>
          </View>
        )}
      </View>

      {/* Status row */}
      <View style={styles.statusRow}>
        <FamilyStatusBadge status={member.status} />
        <Text style={styles.lastSeen}>{formatLastSeen(member.lastSeen)}</Text>
      </View>

      {/* Active journey strip */}
      {member.activeJourneyId && member.activeJourneyDestination && (
        <View style={styles.journeyStrip}>
          <Text style={styles.journeyIcon}>🧭</Text>
          <View style={styles.journeyInfo}>
            <Text style={styles.journeyDest} numberOfLines={1}>
              {member.activeJourneyDestination}
            </Text>
            {eta && <Text style={styles.journeyEta}>ETA: {eta}</Text>}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  nameBlock: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  relationship: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  batteryBadge: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  batteryText: {
    fontSize: 11,
    fontWeight: '700',
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
  journeyStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  journeyIcon: { fontSize: 14 },
  journeyInfo: { flex: 1, gap: 2 },
  journeyDest: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  journeyEta: {
    fontSize: 11,
    color: COLORS.primary,
  },
});
