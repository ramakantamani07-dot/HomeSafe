import React from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../src/config/theme';
import { useFamily } from '../../src/hooks/useFamily';
import { FamilyMemberCard } from '../../src/components/family/FamilyMemberCard';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { Button } from '../../src/components/ui/Button';
import { Section, ListRow } from '../../src/components/ui/Section';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { useBasicPhoneMembers } from '../../src/hooks/useBasicPhoneMembers';
import { describeConsentStatus } from '../../src/models/BasicPhoneMember';
import { allowsLocationLookup, isTerminal } from '../../src/models/Consent';

const heroImage = require('../../assets/family/bg.png');
import { Icon } from '../../src/components/ui/Icon';

export default function FamilyScreen() {
  const theme = useTheme();
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
  } = useFamily();

  const { enabled: basicPhoneEnabled, members: basicMembers } = useBasicPhoneMembers();

  const [accepting, setAccepting] = React.useState<string | null>(null);

  const handleAccept = async (invitationId: string, fromName: string) => {
    Alert.alert(
      'Accept Invitation',
      `Connect with ${fromName} as a family member?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setAccepting(invitationId);
            try {
              await acceptInvitation(invitationId);
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to accept.');
            } finally {
              setAccepting(null);
            }
          },
        },
      ],
    );
  };

  const handleDecline = async (invitationId: string) => {
    await declineInvitation(invitationId);
  };

  const handleCancelSent = async (invitationId: string, toPhone: string) => {
    Alert.alert(
      'Cancel Invitation',
      `Cancel the invitation sent to ${toPhone}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancel Invite',
          style: 'destructive',
          onPress: () => cancelInvitation(invitationId),
        },
      ],
    );
  };

  const pendingSent = sentInvitations.filter((i) => i.status === 'PENDING');

  // Members needing attention surface first — everyone else follows in
  // whatever order the service returned. See the redesign audit §14.
  const sortedMembers = [...members].sort((a, b) => {
    const aAttention = a.status === 'SOS_ACTIVE' ? 0 : 1;
    const bAttention = b.status === 'SOS_ACTIVE' ? 0 : 1;
    return aAttention - bAttention;
  });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Family</Text>
        <TouchableOpacity
          style={[styles.inviteButton, { backgroundColor: theme.accent }]}
          onPress={() => router.push('/add-someone')}
          accessibilityRole="button"
          accessibilityLabel="Add someone"
        >
          <Icon name="add" size={20} color={theme.textOnColor} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={theme.accent} />
        }
      >
        <ImageBackground source={heroImage} style={styles.hero} imageStyle={styles.heroImage}>
          <View
            style={[
              styles.heroScrim,
              { backgroundColor: theme.isDark ? 'rgba(8,12,28,0.68)' : 'rgba(255,255,255,0.4)' },
            ]}
          />
          <Text style={[styles.heroTitle, { color: theme.textPrimary }]}>
            A safer journey together
          </Text>
          <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
            Keep your family connected and informed, wherever life takes you.
          </Text>
        </ImageBackground>

        {/* Error */}
        {error && (
          <View style={[styles.errorCard, { backgroundColor: theme.critical.bg }]}>
            <Text style={[styles.errorText, { color: theme.critical.fg }]}>{error}</Text>
          </View>
        )}

        {/* Pending invitations received */}
        {pendingInvitations.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
              Pending Invitations ({pendingInvitations.length})
            </Text>
            {pendingInvitations.map((inv) => (
              <View
                key={inv.id}
                style={[styles.inviteCard, { backgroundColor: theme.surface, borderColor: theme.accent }]}
              >
                <View style={styles.inviteInfo}>
                  <Text style={[styles.inviteName, { color: theme.textPrimary }]}>{inv.fromDisplayName}</Text>
                  <Text style={[styles.invitePhone, { color: theme.textSecondary }]}>{inv.fromPhone}</Text>
                  <Text style={[styles.inviteRelationship, { color: theme.textTertiary }]}>{inv.relationship}</Text>
                </View>
                <View style={styles.inviteActions}>
                  <Button
                    label="Accept"
                    onPress={() => handleAccept(inv.id, inv.fromDisplayName)}
                    loading={accepting === inv.id}
                    style={styles.inviteActionHalf}
                  />
                  <Button
                    label="Decline"
                    onPress={() => handleDecline(inv.id)}
                    variant="secondary"
                    style={styles.inviteActionHalf}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Family members */}
        <View style={styles.section}>
          {sortedMembers.length > 0 ? (
            <>
              <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
                Family Members ({sortedMembers.length})
              </Text>
              {sortedMembers.map((member) => (
                <FamilyMemberCard
                  key={member.id}
                  member={member}
                  onPress={() =>
                    router.push({
                      pathname: '/family-member',
                      params: { connectionId: member.connectionId },
                    })
                  }
                />
              ))}
            </>
          ) : (
            !isLoading && basicMembers.length === 0 && (
              <EmptyState
                icon="people"
                title="No family members yet"
                description="Invite family members to see their live safety status during journeys."
                actionLabel="Add someone"
                onAction={() => router.push('/add-someone')}
              />
            )
          )}
          {basicMembers.length > 0 && (
            <Section title={`Basic phone (${basicMembers.length})`}>
              {basicMembers.map((m) => (
                <ListRow
                  key={m.id}
                  icon="person"
                  title={m.displayName}
                  subtitle={describeConsentStatus(m.consentStatus)}
                  onPress={() => router.push({ pathname: '/basic-member', params: { memberId: m.id } })}
                  accessory={
                    allowsLocationLookup(m.consentStatus) ? (
                      <StatusBadge label="Consent ✓" severity="safe" />
                    ) : isTerminal(m.consentStatus) ? undefined : (
                      <StatusBadge label="Pending" severity="warning" />
                    )
                  }
                />
              ))}
            </Section>
          )}
          {(sortedMembers.length > 0 || basicMembers.length > 0) && (
            <Button
              label="Add someone"
              icon="add"
              onPress={() => router.push('/add-someone')}
              variant="secondary"
              style={styles.addMemberButton}
            />
          )}
        </View>

        {basicPhoneEnabled && (
          <View style={[styles.sentCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sentRelationship, styles.sentInfo, { color: theme.textSecondary }]}>
              People with a basic phone can be found by their mobile network — only after they
              reply YES by text. They're texted when you look, at most once an hour.
            </Text>
          </View>
        )}

        {/* Sent invitations */}
        {pendingSent.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
              Sent Invitations ({pendingSent.length})
            </Text>
            {pendingSent.map((inv) => (
              <View
                key={inv.id}
                style={[styles.sentCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={styles.sentInfo}>
                  <Text style={[styles.sentPhone, { color: theme.textPrimary }]}>{inv.toPhone}</Text>
                  <Text style={[styles.sentRelationship, { color: theme.textSecondary }]}>{inv.relationship}</Text>
                  <Text style={[styles.sentExpiry, { color: theme.textTertiary }]}>
                    Expires {inv.expiresAt.toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.cancelSentButton, { borderColor: theme.border }]}
                  onPress={() => handleCancelSent(inv.id, inv.toPhone)}
                >
                  <Text style={[styles.cancelSentText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {isLoading && sortedMembers.length === 0 && (
          <ActivityIndicator style={styles.loader} color={theme.accent} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: TYPOGRAPHY.heading.fontSize,
    fontWeight: TYPOGRAPHY.heading.fontWeight,
  },
  inviteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    height: 190,
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.lg,
    padding: SPACING.xl,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroImage: {
    borderRadius: RADIUS.xl,
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  heroTitle: {
    fontSize: TYPOGRAPHY.heading.fontSize + 2,
    fontWeight: '800',
    marginBottom: SPACING.xs,
    maxWidth: '70%',
  },
  heroSubtitle: {
    fontSize: TYPOGRAPHY.callout.fontSize,
    lineHeight: TYPOGRAPHY.callout.lineHeight,
    maxWidth: '65%',
  },
  container: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
    gap: SPACING.xs,
  },
  section: {
    marginBottom: SPACING.sm,
  },
  sectionHeader: {
    fontSize: TYPOGRAPHY.caption.fontSize,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  errorCard: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  errorText: {
    fontSize: TYPOGRAPHY.callout.fontSize,
  },
  inviteCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
  },
  inviteInfo: {
    gap: 2,
  },
  inviteName: {
    fontSize: TYPOGRAPHY.bodyStrong.fontSize,
    fontWeight: TYPOGRAPHY.bodyStrong.fontWeight,
  },
  invitePhone: {
    fontSize: TYPOGRAPHY.callout.fontSize,
  },
  inviteRelationship: {
    fontSize: TYPOGRAPHY.caption.fontSize,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  inviteActionHalf: {
    flex: 1,
  },
  addMemberButton: {
    marginTop: SPACING.md,
  },
  sentCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  sentInfo: {
    flex: 1,
    gap: 2,
  },
  sentPhone: {
    fontSize: TYPOGRAPHY.callout.fontSize,
    fontWeight: '600',
  },
  sentRelationship: {
    fontSize: TYPOGRAPHY.caption.fontSize,
  },
  sentExpiry: {
    fontSize: TYPOGRAPHY.caption.fontSize,
  },
  cancelSentButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  cancelSentText: {
    fontSize: TYPOGRAPHY.callout.fontSize,
  },
  loader: {
    marginTop: SPACING.xxxl,
  },
});
