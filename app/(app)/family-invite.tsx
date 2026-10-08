import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../src/config/theme';
import { useFamily } from '../../src/hooks/useFamily';
import { useBasicPhoneMembers } from '../../src/hooks/useBasicPhoneMembers';
import { normaliseContactNumber, type InviteeStatus, type TheyAreMy } from '../../src/models/Family';
import { PhoneInput } from '../../src/components/common/PhoneInput';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Button } from '../../src/components/ui/Button';
import { Icon } from '../../src/components/ui/Icon';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { RelationshipChips } from '../../src/components/family/RelationshipChips';
import { WhatIsShared } from '../../src/components/family/WhatIsShared';

const E164 = /^\+[1-9]\d{6,14}$/;

/**
 * Invite someone (Phase 5b; replaces "Invite Family Member").
 *
 * Choose from contacts first — fastest, and the only path that may say
 * whether someone is on wayLoc (decision F1: only for a person the inviter
 * already has in their contacts). Typing a number never triggers that lookup.
 *
 * The board's "we'll text a link" is not offered: there is no SMS provider
 * yet (F2). Invite sent offers "send them a message yourself" instead.
 */
export default function InviteSomeoneScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();
  const { inviteMember, canPickContacts, pickContact, lookupInvitee } = useFamily();
  const { enabled: basicPhoneEnabled } = useBasicPhoneMembers();

  const [phone, setPhone] = useState('');
  // Bumped to re-seed PhoneInput when a contact fills the number in.
  const [phoneKey, setPhoneKey] = useState(0);
  const [picked, setPicked] = useState<{ name: string; phone: string } | null>(null);
  const [status, setStatus] = useState<InviteeStatus>('unknown');
  const [theyAreMy, setTheyAreMy] = useState<TheyAreMy | null>(null);
  const [sending, setSending] = useState(false);

  const name = picked?.name || null;
  const who = name?.split(' ')[0] ?? 'them';
  const valid = E164.test(phone);
  const ready = valid && theyAreMy !== null;

  const choose = async () => {
    const contact = await pickContact();
    if (!contact) return;
    const number = contact.phoneNumbers.map(normaliseContactNumber).find((n): n is string => n !== null);
    if (!number) {
      Alert.alert(
        `No number we can use for ${contact.name || 'them'}`,
        'Type their mobile number, with its country code.',
      );
      return;
    }
    setPicked({ name: contact.name, phone: number });
    setPhone(number);
    setPhoneKey((k) => k + 1);
    setStatus('unknown');
    // F1: only for someone from their own contacts.
    setStatus(await lookupInvitee(number));
  };

  const typed = (value: string) => {
    setPhone(value);
    // A typed number is no longer the contact that was picked.
    if (picked && value !== picked.phone) {
      setPicked(null);
      setStatus('unknown');
    }
  };

  const send = async () => {
    if (!ready || !theyAreMy) return;
    setSending(true);
    try {
      const invitation = await inviteMember(phone, theyAreMy);
      router.replace({
        pathname: '/invite-sent',
        params: {
          name: name ?? '',
          phone,
          theyAreMy,
          expiresAt: invitation.expiresAt.toISOString(),
          status,
        },
      });
    } catch (err) {
      Alert.alert("Couldn't send the invite", err instanceof Error ? err.message : 'Try again in a moment.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="Invite someone" onBack={() => router.back()} />

          {canPickContacts && (
            <>
              <TouchableOpacity style={styles.contacts} onPress={choose} accessibilityRole="button">
                <Icon name="person" size={18} color={theme.accent} />
                <Text style={styles.contactsText}>Choose from contacts</Text>
              </TouchableOpacity>
              <Text style={styles.or}>or type their number</Text>
            </>
          )}

          <PhoneInput key={phoneKey} initialValue={picked?.phone} onPhoneChange={typed} />

          {picked && (
            <View style={styles.person}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(picked.name || '?').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.personName}>{picked.name || picked.phone}</Text>
                <Text style={styles.personDetail}>From your contacts</Text>
              </View>
              {status === 'on-wayloc' && <StatusBadge label="On wayLoc ✓" severity="safe" />}
              {status === 'not-on-wayloc' && <StatusBadge label="Not on wayLoc" severity="neutral" />}
            </View>
          )}

          {basicPhoneEnabled && valid && status !== 'on-wayloc' && (
            <TouchableOpacity
              onPress={() => router.replace({ pathname: '/add-someone', params: { name: name ?? '', phone } })}
              accessibilityRole="link"
            >
              <Text style={styles.link}>Basic phone with no apps? Ask them by SMS instead</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.question}>Who is {name ? who : 'this person'} to you?</Text>
          <RelationshipChips value={theyAreMy} onChange={setTheyAreMy} />

          <WhatIsShared name={name ? who : 'They'} />
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={name ? `Send invite to ${who}` : 'Send invite'}
            icon="message"
            variant="primary"
            onPress={send}
            disabled={!ready}
            loading={sending}
          />
          <Text style={styles.footnote}>
            Not on wayLoc yet? After sending, you can message them how to join.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    flex: { flex: 1 },
    container: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
    contacts: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      minHeight: 52,
      borderRadius: RADIUS.pill,
      backgroundColor: theme.accentMuted,
    },
    contactsText: { fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.accent },
    or: { textAlign: 'center', fontSize: 13, fontFamily: FONTS.body, color: theme.textSecondary },
    person: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      padding: SPACING.md,
      borderRadius: RADIUS.lg,
      backgroundColor: theme.surface,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
    },
    avatarText: { fontSize: 16, fontFamily: FONTS.heading, color: theme.textOnColor },
    personName: { fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    personDetail: { fontSize: 13, fontFamily: FONTS.body, color: theme.textSecondary },
    link: { fontSize: 14, fontFamily: FONTS.bodySemibold, color: theme.accent },
    question: { fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.textPrimary, marginTop: SPACING.xs },
    footer: { padding: SPACING.lg, gap: SPACING.sm },
    footnote: { textAlign: 'center', fontSize: 13, fontFamily: FONTS.body, color: theme.textSecondary },
  });
}
