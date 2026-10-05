import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../src/config/theme';
import { useFamily } from '../../src/hooks/useFamily';
import { SHARING_MODE_LABELS, type FamilyPermissions } from '../../src/models/Family';
import { Icon } from '../../src/components/ui/Icon';
import type { ThemeColors } from '../../src/config/theme';

const CATEGORY_TOGGLES: [keyof FamilyPermissions, string][] = [
  ['shareStatus', 'Your status (home / travelling / arrived)'],
  ['shareLocation', 'Your live location'],
  ['shareJourneyDetails', 'Journey destination & ETA'],
  ['shareBattery', 'Your battery level'],
];

export default function DataVisibilityScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();
  const { members, isLoading } = useFamily();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Who Can See My Data</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          This is exactly what each family connection is currently allowed to see about you —
          based on the sharing settings you've set for them. Nothing here is shared with anyone
          who isn't listed below.
        </Text>

        {members.length === 0 && !isLoading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              You have no family connections yet, so no one can see any of your data.
            </Text>
          </View>
        )}

        {members.map((member) => {
          const perms = member.myPermissions;
          const neverShares = perms.sharingMode === 'NEVER_SHARE';
          const duringJourneyOnly = perms.sharingMode === 'SHARE_DURING_JOURNEY';

          return (
            <TouchableOpacity
              key={member.connectionId}
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/family-member',
                  params: { connectionId: member.connectionId },
                })
              }
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.memberName}>{member.displayName}</Text>
                  <Text style={styles.memberRelationship}>{member.relationship}</Text>
                </View>
                <Text style={styles.modeLabel}>{SHARING_MODE_LABELS[perms.sharingMode]}</Text>
              </View>

              {neverShares ? (
                <Text style={styles.nothingSharedText}>Sees none of your data.</Text>
              ) : (
                <View style={styles.toggleList}>
                  {CATEGORY_TOGGLES.map(([key, label]) => {
                    const shared = Boolean(perms[key]);
                    return (
                      <View key={key} style={styles.toggleRow}>
                        <Icon
                          name={shared ? 'checkCircle' : 'close'}
                          size={15}
                          color={shared ? theme.safe.fg : theme.textTertiary}
                        />
                        <Text style={styles.toggleLabel}>{label}</Text>
                      </View>
                    );
                  })}
                  {duringJourneyOnly && (
                    <Text style={styles.conditionNote}>
                      Only while you have an active journey — nothing above is visible to them
                      otherwise.
                    </Text>
                  )}
                </View>
              )}

              <Text style={styles.chevronHint}>Tap to change what {member.displayName} sees →</Text>
            </TouchableOpacity>
          );
        })}
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
    },
    intro: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      color: theme.textSecondary,
      lineHeight: 19,
      marginBottom: SPACING.lg,
    },
    emptyState: {
      paddingVertical: SPACING.xxl,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: TYPOGRAPHY.body.fontSize,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: SPACING.md + 2,
      marginBottom: SPACING.md,
      gap: SPACING.sm + 2,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: SPACING.sm,
    },
    cardHeaderText: {
      flex: 1,
    },
    memberName: {
      fontSize: TYPOGRAPHY.bodyStrong.fontSize,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    memberRelationship: {
      fontSize: TYPOGRAPHY.caption.fontSize,
      color: theme.textTertiary,
    },
    modeLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.accent,
      textAlign: 'right',
      maxWidth: 140,
    },
    nothingSharedText: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      color: theme.textSecondary,
      fontStyle: 'italic',
    },
    toggleList: {
      gap: SPACING.xs + 2,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    toggleLabel: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      color: theme.textPrimary,
    },
    conditionNote: {
      fontSize: 11,
      color: theme.textTertiary,
      fontStyle: 'italic',
      marginTop: 2,
    },
    chevronHint: {
      fontSize: 11,
      color: theme.accent,
      marginTop: 2,
    },
  });
}
