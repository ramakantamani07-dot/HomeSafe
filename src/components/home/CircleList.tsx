import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, SPACING, type ThemeColors } from '../../config/theme';
import { MemberRow } from '../glass';
import type { FamilyMember } from '../../models/Family';

interface CircleListProps {
  members: FamilyMember[];
  onOpenMember(member: FamilyMember): void;
  onCall(member: FamilyMember): void;
}

/**
 * Home's "Your circle" (Option 15 `AI1`).
 *
 * Shows app members today. Basic-phone members join this same list in Phase 6 —
 * MemberRow already handles both kinds, which is why the row takes a `kind`
 * rather than assuming an account exists.
 */
export function CircleList({ members, onOpenMember, onCall }: CircleListProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  if (members.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          No one's watching out for you yet. Add someone you trust from Settings.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <Text style={styles.heading}>Your circle</Text>
      {members.map((member) => (
        <MemberRow
          key={member.id}
          id={member.id}
          name={member.displayName}
          status={describeStatus(member)}
          kind="app"
          onPress={() => onOpenMember(member)}
          onAction={() => onCall(member)}
        />
      ))}
    </View>
  );
}

/**
 * Only states we can actually stand behind.
 *
 * Option 15 §1 principle 4 — never claim something we can't know. A member
 * whose status we have no recent basis for reads as "Not sharing", not as
 * anything reassuring.
 */
function describeStatus(member: FamilyMember): string {
  switch (member.status) {
    case 'HOME':
      return 'At home';
    case 'AT_WORK':
      return 'At work';
    case 'AT_SCHOOL':
      return 'At school';
    case 'TRAVELLING':
      return member.activeJourneyDestination
        ? `On the way to ${member.activeJourneyDestination}`
        : 'On the way';
    case 'ARRIVED':
      return 'Arrived';
    case 'SOS_ACTIVE':
      return 'SOS — needs help';
    case 'OFFLINE':
      return 'Not sharing';
    default:
      return 'Not sharing';
  }
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    list: {
      paddingTop: SPACING.md,
    },
    heading: {
      fontSize: 20,
      fontFamily: FONTS.headingXBold,
      color: theme.textPrimary,
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.sm,
      letterSpacing: -0.3,
    },
    empty: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.xl,
    },
    emptyText: {
      fontSize: 15,
      lineHeight: 21,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
      textAlign: 'center',
    },
  });
}
