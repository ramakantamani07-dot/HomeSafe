import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../src/config/theme';
import { useLiveFamily } from '../../src/hooks/useFamily';
import { useBasicPhoneMembers } from '../../src/hooks/useBasicPhoneMembers';
import { useInterval } from '../../src/hooks/useInterval';
import { describeConsentStatus } from '../../src/models/BasicPhoneMember';
import { allowsLocationLookup } from '../../src/models/Consent';
import type { FamilyMember } from '../../src/models/Family';
import { MemberRow } from '../../src/components/glass';
import { Icon } from '../../src/components/ui/Icon';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { FamilySummary } from '../../src/components/family/FamilySummary';
import { TravellingCard } from '../../src/components/family/TravellingCard';
import { describeAge, describeMemberStatus } from '../../src/components/circle/memberStatus';
import { callNumber } from '../../src/utils/deviceLinks';

/** Re-reads the clock for "updated 2 min ago" and minutes-left while open. */
const CLOCK_TICK_MS = 30_000;

const isOnJourney = (m: FamilyMember) => m.status === 'TRAVELLING' || m.status === 'SOS_ACTIVE';

/**
 * Family (Option 15 S2b).
 *
 * Status is live while this screen is open (`useLiveFamily`) and only then.
 * Order is attention first: whoever needs help, then whoever is travelling,
 * then everyone else — app members and basic-phone members in one list, as
 * the board draws them.
 *
 * Invitations keep a place: someone invited you, or you are waiting on
 * someone, and both need a way to act that the board does not draw.
 */
export default function FamilyScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();
  const {
    members,
    pendingInvitations,
    sentInvitations,
    isLoading,
    error,
    acceptInvitation,
    declineInvitation,
    cancelInvitation,
    refresh,
  } = useLiveFamily();
  const { enabled: basicPhoneEnabled, members: basicMembers, find } = useBasicPhoneMembers();

  const [now, setNow] = useState(() => new Date());
  useInterval(() => setNow(new Date()), CLOCK_TICK_MS);

  const onJourney = members
    .filter(isOnJourney)
    .sort((a, b) => (a.status === 'SOS_ACTIVE' ? -1 : 0) - (b.status === 'SOS_ACTIVE' ? -1 : 0));
  const others = members.filter((m) => !isOnJourney(m));
  const pendingSent = sentInvitations.filter((i) => i.status === 'PENDING');

  const newestUpdate = members
    .map((m) => m.updatedAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  const openMember = (m: FamilyMember) =>
    router.push({ pathname: '/family-member', params: { connectionId: m.connectionId } });

  const accept = (invitationId: string, fromName: string) =>
    Alert.alert(`Join ${fromName}'s family?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: () =>
          acceptInvitation(invitationId).catch(() =>
            Alert.alert("Couldn't accept", 'Check your connection and try again.'),
          ),
      },
    ]);

  const everyone = members.length + basicMembers.length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.circleButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Icon name="chevronLeft" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Family</Text>
        <TouchableOpacity
          style={[styles.circleButton, styles.addButton]}
          onPress={() => router.push('/add-someone')}
          accessibilityRole="button"
          accessibilityLabel="Add someone"
        >
          <Icon name="add" size={22} color={theme.textOnColor} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={theme.accent} />}
      >
        {error && <Text style={styles.error}>{error}</Text>}

        {everyone > 0 && (
          <FamilySummary
            people={[
              ...members.map((m) => ({ id: m.id, name: m.displayName, kind: 'app' as const })),
              ...basicMembers.map((m) => ({ id: m.id, name: m.displayName, kind: 'basic' as const })),
            ]}
            travelling={members.filter((m) => m.status === 'TRAVELLING').length}
            needHelp={members.filter((m) => m.status === 'SOS_ACTIVE').length}
            updatedAt={newestUpdate}
            now={now}
          />
        )}

        {pendingInvitations.length > 0 && (
          <>
            <Text style={styles.section}>INVITATIONS</Text>
            {pendingInvitations.map((inv) => (
              <View key={inv.id} style={styles.inviteCard}>
                <View style={styles.flex}>
                  <Text style={styles.inviteName}>{inv.fromDisplayName}</Text>
                  <Text style={styles.inviteDetail}>Wants you in their family</Text>
                </View>
                <TouchableOpacity accessibilityRole="button" style={styles.pillSecondary} onPress={() => declineInvitation(inv.id)}>
                  <Text style={styles.pillSecondaryText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" style={styles.pillPrimary} onPress={() => accept(inv.id, inv.fromDisplayName)}>
                  <Text style={styles.pillPrimaryText}>Accept</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {onJourney.length > 0 && (
          <>
            <Text style={styles.section}>TRAVELLING NOW</Text>
            {onJourney.map((m) => (
              <TravellingCard
                key={m.id}
                member={m}
                now={now}
                onCall={() => callNumber(m.phoneNumber)}
                onWatch={() => router.push({ pathname: '/watch-member', params: { memberId: m.id } })}
              />
            ))}
          </>
        )}

        {(others.length > 0 || basicMembers.length > 0) && (
          <>
            <Text style={styles.section}>FAMILY</Text>
            <View style={styles.list}>
              {others.map((m) => {
                const age = describeAge(m.updatedAt, now);
                return (
                  <MemberRow
                    key={m.id}
                    id={m.id}
                    name={m.displayName}
                    status={age && m.status !== 'OFFLINE' ? `${describeMemberStatus(m)} · ${age}` : describeMemberStatus(m)}
                    kind="app"
                    onPress={() => openMember(m)}
                    onAction={() => callNumber(m.phoneNumber)}
                  />
                );
              })}
              {basicMembers.map((m) => (
                <MemberRow
                  key={m.id}
                  id={m.id}
                  name={m.displayName}
                  status={
                    allowsLocationLookup(m.consentStatus)
                      ? 'Basic phone · consent ✓'
                      : `Basic phone · ${describeConsentStatus(m.consentStatus).toLowerCase()}`
                  }
                  kind="basic"
                  actionDisabled={!allowsLocationLookup(m.consentStatus)}
                  onPress={() => router.push({ pathname: '/basic-member', params: { memberId: m.id } })}
                  onAction={() => {
                    find(m.id);
                    router.push({ pathname: '/find-result', params: { memberId: m.id } });
                  }}
                />
              ))}
            </View>
          </>
        )}

        {pendingSent.length > 0 && (
          <>
            <Text style={styles.section}>WAITING TO ACCEPT</Text>
            <View style={styles.list}>
              {pendingSent.map((inv) => (
                <View key={inv.id} style={styles.sentRow}>
                  <View style={styles.flex}>
                    <Text style={styles.inviteName}>{inv.toPhone}</Text>
                    <Text style={styles.inviteDetail}>
                      Expires {inv.expiresAt.toLocaleDateString([], { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <StatusBadge label="Pending" severity="warning" />
                  <TouchableOpacity
                    onPress={() => cancelInvitation(inv.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Cancel invitation to ${inv.toPhone}`}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Icon name="close" size={18} color={theme.textTertiary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}

        {everyone === 0 && !isLoading && (
          <Text style={styles.empty}>
            No one yet. Add the people you'd want to know you got home.
          </Text>
        )}

        <TouchableOpacity accessibilityRole="button" style={styles.addSomeone} onPress={() => router.push('/add-someone')}>
          <Icon name="add" size={20} color={theme.accent} />
          <Text style={styles.addSomeoneText}>Add someone</Text>
        </TouchableOpacity>

        {basicPhoneEnabled && (
          <Text style={styles.note}>
            Basic phones are found by their network only after they reply YES. They're texted when
            you look, at most once an hour.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
    },
    circleButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
    },
    addButton: { backgroundColor: theme.accent },
    title: { flex: 1, fontSize: 26, fontFamily: FONTS.headingXBold, color: theme.textPrimary },
    container: { padding: SPACING.lg, paddingTop: SPACING.sm, gap: SPACING.md, paddingBottom: SPACING.xxxl },
    error: { fontSize: 14, fontFamily: FONTS.body, color: theme.critical.fg },
    section: {
      fontSize: 12,
      fontFamily: FONTS.bodySemibold,
      letterSpacing: 0.6,
      color: theme.textSecondary,
      marginTop: SPACING.xs,
    },
    list: { borderRadius: RADIUS.lg, backgroundColor: theme.surface, overflow: 'hidden' },
    inviteCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      padding: SPACING.md,
      borderRadius: RADIUS.lg,
      backgroundColor: theme.surface,
      borderWidth: 1.5,
      borderColor: theme.accent,
    },
    inviteName: { fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    inviteDetail: { fontSize: 13, fontFamily: FONTS.body, color: theme.textSecondary },
    pillPrimary: {
      minHeight: 40,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.pill,
      justifyContent: 'center',
      backgroundColor: theme.accent,
    },
    pillPrimaryText: { fontSize: 14, fontFamily: FONTS.bodySemibold, color: theme.textOnColor },
    pillSecondary: {
      minHeight: 40,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.pill,
      justifyContent: 'center',
      backgroundColor: theme.background,
    },
    pillSecondaryText: { fontSize: 14, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    sentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.lg,
    },
    empty: { fontSize: 15, lineHeight: 21, fontFamily: FONTS.body, color: theme.textSecondary, textAlign: 'center' },
    addSomeone: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      minHeight: 52,
      borderRadius: RADIUS.pill,
      backgroundColor: theme.accentMuted,
    },
    addSomeoneText: { fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.accent },
    note: { fontSize: 13, lineHeight: 18, fontFamily: FONTS.body, color: theme.textSecondary, textAlign: 'center' },
  });
}
