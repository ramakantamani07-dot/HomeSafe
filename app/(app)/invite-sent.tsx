import React from 'react';
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { useGoBack } from '../../src/hooks/useGoBack';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../src/config/theme';
import { INVITATION_EXPIRY_DAYS, type InviteeStatus } from '../../src/models/Family';
import { Button } from '../../src/components/ui/Button';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { Icon } from '../../src/components/ui/Icon';

/**
 * Invite sent (Phase 5b; replaces the alert after sending).
 *
 * What happens next depends on whether they have wayLoc, and the screen says
 * only what is so. The board's "She'll get a notification" holds for someone
 * with the app and notifications on — `onFamilyInvitationCreated` sends it —
 * and for no one else, so the line is conditional. No pronoun is assumed.
 */
export default function InviteSentScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();
  const goBack = useGoBack();
  const params = useLocalSearchParams<{
    name?: string;
    phone: string;
    theyAreMy?: string;
    expiresAt?: string;
    status?: InviteeStatus;
  }>();

  const name = params.name?.trim() || params.phone;
  const first = params.name?.trim().split(' ')[0] || 'They';
  const days = params.expiresAt
    ? Math.max(1, Math.round((new Date(params.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1_000)))
    : INVITATION_EXPIRY_DAYS;

  const next =
    params.status === 'on-wayloc'
      ? `${first} has wayLoc, so it's waiting in the app — with a notification if theirs are on. We'll show them in your family when they accept.`
      : params.status === 'not-on-wayloc'
        ? `${first} isn't on wayLoc yet. When they sign up with this number, the invite will be waiting.`
        : `If ${first} has wayLoc, it's waiting in the app. If not, it will be when they sign up with this number.`;

  // F2: no SMS provider, so the inviter sends the word themselves.
  const messageThem = () =>
    Share.share({
      message:
        "I've added you to my family on wayLoc, so we can see each other get home. Get wayLoc and sign in with this number to accept.",
    }).catch(() => {});

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
          <View style={styles.badge}>
            <Icon name="message" size={14} color={theme.textOnColor} />
          </View>
        </View>
        <Text style={styles.title}>Invite sent to {params.name?.trim() ? first : name}</Text>
        <Text style={styles.next}>{next}</Text>

        <View style={styles.card}>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>
              {name}
              {params.theyAreMy ? ` · ${params.theyAreMy.toLowerCase()}` : ''}
            </Text>
            <Text style={styles.cardDetail}>
              Sent just now · expires in {days} {days === 1 ? 'day' : 'days'}
            </Text>
          </View>
          <StatusBadge label="Pending" severity="warning" />
        </View>

        {params.status !== 'on-wayloc' && (
          <TouchableOpacity style={styles.share} onPress={messageThem} accessibilityRole="button">
            <Icon name="send" size={16} color={theme.accent} />
            <Text style={styles.shareText}>Message {first === 'They' ? 'them' : first} how to join</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.footer}>
        <Button label="Done" variant="primary" onPress={() => goBack()} />
        <TouchableOpacity onPress={() => router.replace('/family-invite')} accessibilityRole="button">
          <Text style={styles.again}>Invite someone else</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    flex: { flex: 1 },
    body: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg, gap: SPACING.md },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
    },
    avatarText: { fontSize: 36, fontFamily: FONTS.heading, color: theme.textOnColor },
    badge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 2,
      borderColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
    },
    title: { fontSize: 24, fontFamily: FONTS.headingXBold, color: theme.textPrimary, textAlign: 'center' },
    next: { fontSize: 15, lineHeight: 21, fontFamily: FONTS.body, color: theme.textSecondary, textAlign: 'center' },
    card: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      padding: SPACING.lg,
      borderRadius: RADIUS.lg,
      backgroundColor: theme.surface,
    },
    cardTitle: { fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    cardDetail: { fontSize: 13, fontFamily: FONTS.body, color: theme.textSecondary },
    share: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, minHeight: 44 },
    shareText: { fontSize: 15, fontFamily: FONTS.bodySemibold, color: theme.accent },
    footer: { padding: SPACING.lg, gap: SPACING.md, alignItems: 'stretch' },
    again: { textAlign: 'center', fontSize: 15, fontFamily: FONTS.bodySemibold, color: theme.accent },
  });
}
