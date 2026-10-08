import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, RADIUS, SPACING, identityColor, type ThemeColors } from '../../config/theme';
import type { FamilyMember } from '../../models/Family';
import { formatEta } from '../../models/RouteResult';
import { Icon } from '../ui/Icon';
import { describeAge, describeMemberStatus } from '../circle/memberStatus';
import { JourneyProgressBar } from './JourneyProgressBar';

interface TravellingCardProps {
  member: FamilyMember;
  now: Date;
  onCall(): void;
  onWatch(): void;
}

/**
 * Someone on a journey, at the top of Family (Option 15 S2b).
 *
 * Every figure comes from what they published: the bar only with a measured
 * progress, "19 min" only from their ETA, and an ETA already past reads as
 * "was due 21:58" — not "arriving", and not "late", which we cannot know.
 */
export function TravellingCard({ member, now, onCall, onWatch }: TravellingCardProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const sos = member.status === 'SOS_ACTIVE';
  const color = identityColor(theme, member.id);
  const age = describeAge(member.updatedAt, now);

  const eta = member.activeJourneyEta;
  const minutesLeft = eta ? Math.round((eta.getTime() - now.getTime()) / 60_000) : null;
  const to = member.activeJourneyDestination ? `to ${member.activeJourneyDestination}` : null;
  const timing =
    eta && minutesLeft !== null && minutesLeft >= 0
      ? [to, `arrives ${formatEta(eta)}`].filter(Boolean).join(' · ')
      : eta
        ? `was due ${formatEta(eta)}`
        : to;

  return (
    <View style={[styles.card, sos && styles.cardSos]}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={styles.avatarText}>{member.displayName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.name} numberOfLines={1}>
            {member.displayName}
            <Text style={styles.relationship}> · {member.relationship.toLowerCase()}</Text>
          </Text>
          <Text style={[styles.status, sos && styles.statusSos]} numberOfLines={1}>
            {describeMemberStatus(member)}
            {age ? ` · ${age}` : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.call}
          onPress={onCall}
          accessibilityRole="button"
          accessibilityLabel={`Call ${member.displayName}`}
        >
          <Icon name="call" size={18} color={theme.safe.fg} />
        </TouchableOpacity>
      </View>

      {member.journeyProgress && (
        <JourneyProgressBar fraction={member.journeyProgress.fraction} dotColor={color} />
      )}

      <View style={styles.footer}>
        <View style={styles.flex}>
          {minutesLeft !== null && minutesLeft >= 0 && <Text style={styles.minutes}>{minutesLeft} min</Text>}
          {timing && <Text style={styles.timing}>{timing}</Text>}
        </View>
        <TouchableOpacity style={styles.watch} onPress={onWatch} accessibilityRole="button">
          <Text style={styles.watchText}>Watch live</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    card: { padding: SPACING.lg, borderRadius: RADIUS.lg, backgroundColor: theme.surface, gap: SPACING.md },
    cardSos: { borderWidth: 2, borderColor: theme.critical.fg },
    header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    flex: { flex: 1 },
    avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 17, fontFamily: FONTS.heading, color: theme.textOnColor },
    name: { fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    relationship: { fontFamily: FONTS.body, color: theme.textSecondary },
    status: { fontSize: 14, fontFamily: FONTS.body, color: theme.textSecondary },
    statusSos: { color: theme.critical.fg, fontFamily: FONTS.bodySemibold },
    call: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.safe.bg,
    },
    footer: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.md },
    minutes: { fontSize: 24, fontFamily: FONTS.headingXBold, color: theme.textPrimary },
    timing: { fontSize: 13, fontFamily: FONTS.body, color: theme.textSecondary },
    watch: {
      minHeight: 44,
      paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
    },
    watchText: { fontSize: 15, fontFamily: FONTS.bodySemibold, color: theme.textOnColor },
  });
}
