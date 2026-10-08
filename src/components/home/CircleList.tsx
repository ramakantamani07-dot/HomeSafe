import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, SPACING, type ThemeColors } from '../../config/theme';
import { MemberRow } from '../glass';
import type { FamilyMember } from '../../models/Family';
import { describeConsentStatus, type BasicPhoneMember } from '../../models/BasicPhoneMember';
import { allowsLocationLookup } from '../../models/Consent';
import { describeMemberStatus } from '../circle/memberStatus';

interface CircleListProps {
  members: FamilyMember[];
  onOpenMember(member: FamilyMember): void;
  onCall(member: FamilyMember): void;
  /** Basic-phone members, after app members — one list, two kinds (S2). */
  basicMembers?: BasicPhoneMember[];
  onOpenBasicMember?(member: BasicPhoneMember): void;
  onFind?(member: BasicPhoneMember): void;
}

/**
 * Home's "Your circle" (Option 15 `AI1`).
 *
 * App members and basic-phone members in one list — MemberRow handles both
 * kinds, which is why the row takes a `kind` rather than assuming an account
 * exists. Find is enabled only once consent is ACTIVE; until then the row says
 * why, in the same words as the member's own screen.
 */
export function CircleList({
  members,
  onOpenMember,
  onCall,
  basicMembers = [],
  onOpenBasicMember,
  onFind,
}: CircleListProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  if (members.length === 0 && basicMembers.length === 0) {
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
          status={describeMemberStatus(member)}
          kind="app"
          onPress={() => onOpenMember(member)}
          onAction={() => onCall(member)}
        />
      ))}
      {basicMembers.map((member) => (
        <MemberRow
          key={member.id}
          id={member.id}
          name={member.displayName}
          status={
            allowsLocationLookup(member.consentStatus)
              ? 'Basic phone'
              : describeConsentStatus(member.consentStatus)
          }
          kind="basic"
          actionDisabled={!allowsLocationLookup(member.consentStatus)}
          onPress={() => onOpenBasicMember?.(member)}
          onAction={() => onFind?.(member)}
        />
      ))}
    </View>
  );
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
