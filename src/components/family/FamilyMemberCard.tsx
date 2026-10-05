import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { FamilyMember, FamilyStatusType } from '../../models/Family';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../config/theme';
import { RADIUS, SPACING, TYPOGRAPHY, identityColor } from '../../config/theme';
import { Icon } from '../ui/Icon';
import { FamilyStatusBadge } from './FamilyStatusBadge';

// Only the statuses we actually have art for — deliberately no placeholder
// for the rest (At Work, At Home, Shopping, Offline, Arrived) rather than
// stretching one generic image across statuses it doesn't depict.
const STATUS_ILLUSTRATIONS: Partial<Record<FamilyStatusType, number>> = {
  TRAVELLING: require('../../../assets/family/route.png'),
  AT_SCHOOL: require('../../../assets/family/school.png'),
};

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
  const theme = useTheme();
  const styles = getStyles(theme);
  const needsAttention = member.status === 'SOS_ACTIVE';

  const eta = member.activeJourneyEta ? formatEta(member.activeJourneyEta) : null;
  const batteryPct =
    member.batteryLevel != null ? Math.round(member.batteryLevel * 100) : null;

  const batteryColor =
    batteryPct != null && batteryPct < 20
      ? theme.critical.fg
      : batteryPct != null && batteryPct < 40
        ? theme.warning.fg
        : theme.textSecondary;

  const illustration = STATUS_ILLUSTRATIONS[member.status];

  return (
    <TouchableOpacity
      style={[styles.card, needsAttention && styles.cardAttention]}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      accessibilityRole="button"
      accessibilityLabel={`${member.displayName}, ${member.relationship}${needsAttention ? ', needs attention' : ''}`}
    >
      {/* Avatar + name row */}
      <View style={styles.headerRow}>
        <View style={[styles.avatar, { backgroundColor: identityColor(theme, member.id) }]}>
          <Text style={styles.avatarText}>{initials(member.displayName)}</Text>
        </View>

        <View style={styles.nameBlock}>
          <Text style={styles.name} numberOfLines={1}>{member.displayName}</Text>
          <Text style={styles.relationship}>{member.relationship}</Text>
        </View>

        {/* Battery — only shown if low, per the redesign's "only what matters" principle */}
        {batteryPct != null && batteryPct < 40 && (
          <View style={styles.batteryRow}>
            <Icon name="battery" size={14} color={batteryColor} />
            <Text style={[styles.batteryText, { color: batteryColor }]}>{batteryPct}%</Text>
          </View>
        )}
      </View>

      {/* Status row */}
      <View style={styles.statusRow}>
        <View style={styles.statusLeft}>
          <FamilyStatusBadge status={member.status} />
          <Text style={styles.lastSeen}>{formatLastSeen(member.lastSeen)}</Text>
        </View>
        <View style={styles.statusRight}>
          {illustration && (
            <Image source={illustration} style={styles.illustration} resizeMode="contain" />
          )}
          {onPress && <Icon name="chevronRight" size={16} color={theme.textTertiary} />}
        </View>
      </View>

      {/* Active journey strip */}
      {member.activeJourneyId && member.activeJourneyDestination && (
        <View style={styles.journeyStrip}>
          <Icon name="compass" size={14} color={theme.accent} />
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

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      gap: SPACING.sm,
    },
    // Left accent bar + tint, not a full red card — attention should read as
    // distinct without being alarming for what may just be an active alert
    // that's already being handled. See the redesign audit §14.
    cardAttention: {
      borderColor: theme.critical.fg,
      borderLeftWidth: 4,
      backgroundColor: theme.critical.bg,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.textOnColor,
    },
    nameBlock: {
      flex: 1,
      gap: 2,
    },
    name: {
      fontSize: TYPOGRAPHY.bodyStrong.fontSize,
      fontWeight: TYPOGRAPHY.bodyStrong.fontWeight,
      color: theme.textPrimary,
    },
    relationship: {
      fontSize: TYPOGRAPHY.caption.fontSize,
      color: theme.textSecondary,
    },
    batteryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    batteryText: {
      fontSize: TYPOGRAPHY.caption.fontSize,
      fontWeight: '700',
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    statusLeft: {
      gap: SPACING.xs,
      alignItems: 'flex-start',
    },
    statusRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
    },
    illustration: {
      width: 56,
      height: 40,
    },
    lastSeen: {
      fontSize: TYPOGRAPHY.caption.fontSize,
      color: theme.textTertiary,
    },
    journeyStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.accentMuted,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.sm,
      gap: SPACING.sm,
    },
    journeyInfo: { flex: 1, gap: 2 },
    journeyDest: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      fontWeight: '600',
      color: theme.accent,
    },
    journeyEta: {
      fontSize: TYPOGRAPHY.caption.fontSize,
      color: theme.accent,
    },
  });
}
