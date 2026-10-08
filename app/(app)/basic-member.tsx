import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { FEATURE_COLORS, FONTS, RADIUS, SPACING, type ThemeColors } from '../../src/config/theme';
import {
  useBasicPhoneMember,
  useBasicPhoneMembers,
  useMemberConsent,
  useMemberFinds,
} from '../../src/hooks/useBasicPhoneMembers';
import { describeConsentStatus } from '../../src/models/BasicPhoneMember';
import { allowsLocationLookup, isTerminal, type ConsentStatus } from '../../src/models/Consent';
import { LOCATE_LIMIT_PER_HOUR } from '../../src/models/LocateAudit';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Section, ListRow } from '../../src/components/ui/Section';
import { StatusBadge, type Severity } from '../../src/components/ui/StatusBadge';
import { Button } from '../../src/components/ui/Button';
import { LastFinds } from '../../src/components/circle/LastFinds';

/**
 * A basic-phone member: consent and finds (Option 15 S3).
 *
 * Status is live — a STOP shows here the moment the server records it.
 *
 * Diverges from the board in two places, both for principle 4:
 *  - "Resend consent text" is absent. A client may only create a consent or
 *    revoke it (D17), so a resend needs a server function that does not exist
 *    yet; a row that did nothing would be worse than no row.
 *  - "Text Sam each time · Always" reads "At most once an hour", because that
 *    is what the server does (spec §5's throttle).
 */
export default function BasicMemberScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();
  const { memberId } = useLocalSearchParams<{ memberId: string }>();

  const member = useBasicPhoneMember(memberId);
  const consent = useMemberConsent(memberId);
  const audits = useMemberFinds(memberId);
  const { find, stopFinding } = useBasicPhoneMembers();
  const [now] = useState(() => new Date());

  if (!member) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.container}>
          <ScreenHeader title="Not found" onBack={() => router.back()} />
          <Text style={styles.body}>This person is no longer in your circle.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const name = member.displayName;
  const status: ConsentStatus = consent?.status ?? member.consentStatus;
  const statusLine =
    status === 'ACTIVE' && consent?.activatedAt
      ? `Said YES ${consent.activatedAt.toLocaleDateString([], { day: 'numeric', month: 'short' })}`
      : describeConsentStatus(status, consent?.requestDelivery ?? null);

  const confirmStop = () =>
    Alert.alert(
      `Stop finding ${name}?`,
      `You won't be able to see ${name}'s location. To start again, you'll need to ask them again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Stop finding', style: 'destructive', onPress: () => stopFinding(member.id) },
      ],
    );

  const findNow = () => {
    find(member.id);
    router.push({ pathname: '/find-result', params: { memberId: member.id } });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader title={name} onBack={() => router.back()} />

        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.number}>{member.phoneNumber}</Text>
            <Text style={styles.statusLine}>{statusLine}</Text>
          </View>
          <StatusBadge {...badgeFor(status)} />
        </View>

        {allowsLocationLookup(status) && (
          <Button label={`Find ${name}`} icon="gps" variant="primary" onPress={findNow} />
        )}

        <Text style={styles.sectionLabel}>LAST FINDS</Text>
        <LastFinds audits={audits} now={now} />

        <Section>
          <ListRow icon="time" title="Limit" value={`${LOCATE_LIMIT_PER_HOUR} finds an hour`} />
          <ListRow icon="message" title={`Text ${name} when you look`} value="At most once an hour" />
        </Section>

        {isTerminal(status) ? (
          <Button
            label={`Ask ${name} again`}
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/add-someone', params: { name, phone: member.phoneNumber } })
            }
          />
        ) : (
          <Button label={`Stop finding ${name}`} variant="destructive" onPress={confirmStop} />
        )}
        <Text style={styles.footnote}>{name} can stop anytime by texting STOP.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function badgeFor(status: ConsentStatus): { label: string; severity: Severity } {
  if (status === 'ACTIVE') return { label: 'Active', severity: 'safe' };
  if (isTerminal(status)) return { label: 'Not sharing', severity: 'neutral' };
  return { label: 'Pending', severity: 'warning' };
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    flex: { flex: 1 },
    container: { padding: SPACING.lg, gap: SPACING.md },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      padding: SPACING.lg,
      borderRadius: RADIUS.lg,
      backgroundColor: theme.surface,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: FEATURE_COLORS.basicPhone,
    },
    avatarText: { fontSize: 18, fontFamily: FONTS.heading, color: theme.textOnColor },
    number: { fontSize: 17, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    statusLine: { fontSize: 14, fontFamily: FONTS.body, color: theme.textSecondary },
    sectionLabel: {
      fontSize: 12,
      fontFamily: FONTS.bodySemibold,
      letterSpacing: 0.6,
      color: theme.textSecondary,
      marginTop: SPACING.sm,
    },
    body: { fontSize: 15, fontFamily: FONTS.body, color: theme.textSecondary },
    footnote: { textAlign: 'center', fontSize: 13, fontFamily: FONTS.body, color: theme.textSecondary },
  });
}
