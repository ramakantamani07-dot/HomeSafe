import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { FamilyStatusType } from '../../models/Family';
import { FAMILY_STATUS_LABELS } from '../../models/Family';
import { COLORS } from '../../config/constants';

const STATUS_COLORS: Record<FamilyStatusType, { bg: string; text: string; dot: string }> = {
  HOME: { bg: COLORS.successLight, text: COLORS.success, dot: COLORS.success },
  TRAVELLING: { bg: COLORS.primaryLight, text: COLORS.primary, dot: COLORS.primary },
  ARRIVED: { bg: COLORS.successLight, text: COLORS.success, dot: COLORS.success },
  AT_WORK: { bg: '#EDE9FE', text: '#7C3AED', dot: '#7C3AED' },
  AT_SCHOOL: { bg: '#FEF3C7', text: '#B45309', dot: '#B45309' },
  SHOPPING: { bg: '#FCE7F3', text: '#BE185D', dot: '#BE185D' },
  OFFLINE: { bg: '#F3F4F6', text: COLORS.textMuted, dot: COLORS.textMuted },
  SOS_ACTIVE: { bg: COLORS.dangerLight, text: COLORS.danger, dot: COLORS.danger },
};

interface FamilyStatusBadgeProps {
  status: FamilyStatusType;
  /** Show a pulsing dot for active/real-time statuses */
  showDot?: boolean;
}

export function FamilyStatusBadge({ status, showDot = true }: FamilyStatusBadgeProps) {
  const colors = STATUS_COLORS[status];
  const isLive = status === 'TRAVELLING' || status === 'SOS_ACTIVE';

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      {showDot && (
        <View style={[styles.dot, { backgroundColor: colors.dot }]} />
      )}
      <Text style={[styles.label, { color: colors.text }]}>
        {FAMILY_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
