import React from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { COLORS } from '../../src/config/constants';
import { useFamily } from '../../src/hooks/useFamily';
import { FamilyMemberCard } from '../../src/components/family/FamilyMemberCard';

export default function FamilyScreen() {
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Family</Text>
        <TouchableOpacity
          style={styles.inviteButton}
          onPress={() => router.push('/family-invite')}
          accessibilityLabel="Invite a family member"
        >
          <Text style={styles.inviteButtonText}>+ Invite</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Error */}
        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Pending invitations received */}
        {pendingInvitations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>
              Pending Invitations ({pendingInvitations.length})
            </Text>
            {pendingInvitations.map((inv) => (
              <View key={inv.id} style={styles.inviteCard}>
                <View style={styles.inviteInfo}>
                  <Text style={styles.inviteName}>{inv.fromDisplayName}</Text>
                  <Text style={styles.invitePhone}>{inv.fromPhone}</Text>
                  <Text style={styles.inviteRelationship}>{inv.relationship}</Text>
                </View>
                <View style={styles.inviteActions}>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAccept(inv.id, inv.fromDisplayName)}
                    disabled={accepting === inv.id}
                  >
                    {accepting === inv.id ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.declineButton}
                    onPress={() => handleDecline(inv.id)}
                  >
                    <Text style={styles.declineButtonText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Family members */}
        <View style={styles.section}>
          {members.length > 0 ? (
            <>
              <Text style={styles.sectionHeader}>
                Family Members ({members.length})
              </Text>
              {members.map((member) => (
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
            !isLoading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>👨‍👩‍👧‍👦</Text>
                <Text style={styles.emptyTitle}>No family members yet</Text>
                <Text style={styles.emptyDesc}>
                  Invite family members to see their live safety status during journeys.
                </Text>
                <TouchableOpacity
                  style={styles.emptyInviteButton}
                  onPress={() => router.push('/family-invite')}
                >
                  <Text style={styles.emptyInviteButtonText}>Invite Someone</Text>
                </TouchableOpacity>
              </View>
            )
          )}
        </View>

        {/* Sent invitations */}
        {pendingSent.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>
              Sent Invitations ({pendingSent.length})
            </Text>
            {pendingSent.map((inv) => (
              <View key={inv.id} style={styles.sentCard}>
                <View style={styles.sentInfo}>
                  <Text style={styles.sentPhone}>{inv.toPhone}</Text>
                  <Text style={styles.sentRelationship}>{inv.relationship}</Text>
                  <Text style={styles.sentExpiry}>
                    Expires {inv.expiresAt.toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.cancelSentButton}
                  onPress={() => handleCancelSent(inv.id, inv.toPhone)}
                >
                  <Text style={styles.cancelSentText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {isLoading && members.length === 0 && (
          <ActivityIndicator style={styles.loader} color={COLORS.primary} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  inviteButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  inviteButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  container: {
    padding: 16,
    paddingBottom: 48,
    gap: 4,
  },
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 8,
  },
  errorCard: {
    backgroundColor: COLORS.dangerLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.danger,
  },
  inviteCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '50',
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  inviteInfo: {
    gap: 2,
  },
  inviteName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  invitePhone: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  inviteRelationship: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  declineButton: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  declineButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  sentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sentInfo: {
    flex: 1,
    gap: 2,
  },
  sentPhone: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  sentRelationship: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  sentExpiry: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  cancelSentButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelSentText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyIcon: { fontSize: 52 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  emptyDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  emptyInviteButton: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyInviteButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  loader: {
    marginTop: 40,
  },
});
