import React from 'react';
import { ActionSheetIOS, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { FONTS, RADIUS, SPACING, identityColor, type ThemeColors } from '../../src/config/theme';
import { useContacts } from '../../src/hooks/useContacts';
import { useFamily } from '../../src/hooks/useFamily';
import { useGoBack } from '../../src/hooks/useGoBack';
import { MAX_CONTACTS, contactBadges, type Contact } from '../../src/models/Contact';
import { Icon } from '../../src/components/ui/Icon';
import { WhatTheyGet } from '../../src/components/contacts/WhatTheyGet';

/**
 * Trusted contacts (trust boards: empty and list).
 *
 * Numbered because order means something: Emergency mode offers to call the
 * first person. Reordering is Move up / Move down from a person's menu — the
 * board draws drag handles; dragging can replace the menu later without
 * changing what the order means.
 *
 * Board badges "On wayLoc / SMS only" are not shown: knowing who has the app
 * needs the account lookup, which F1 limits to people picked from contacts.
 * Rows show what each person will be told about instead.
 */
export default function TrustedContactsScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();
  const goBack = useGoBack();
  const { contacts, isLoading, addContact, moveContact, sendTestAlert, smsAlertsEnabled } = useContacts();
  const { members } = useFamily();

  const full = contacts.length >= MAX_CONTACTS;
  const suggestions = members
    .filter((m) => m.phoneNumber && !contacts.some((c) => c.phone === m.phoneNumber))
    .slice(0, 3);

  const addSuggested = async (name: string, phone: string) => {
    try {
      await addContact({ name, phone, relationship: 'Family' });
    } catch (err) {
      Alert.alert("Couldn't add them", err instanceof Error ? err.message : 'Try again in a moment.');
    }
  };

  const openMenu = (contact: Contact, index: number) => {
    const options = [
      'Change alerts',
      ...(index > 0 ? ['Move up'] : []),
      ...(index < contacts.length - 1 ? ['Move down'] : []),
      'Cancel',
    ];
    const act = (choice: string) => {
      if (choice === 'Change alerts') router.push({ pathname: '/contact-edit', params: { contactId: contact.id } });
      if (choice === 'Move up') void moveContact(contact.id, 'up');
      if (choice === 'Move down') void moveContact(contact.id, 'down');
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: contact.name, options, cancelButtonIndex: options.length - 1 },
        (i) => act(options[i]),
      );
    } else {
      Alert.alert(
        contact.name,
        undefined,
        options.map((o) => ({ text: o, style: o === 'Cancel' ? 'cancel' : 'default', onPress: () => act(o) })),
      );
    }
  };

  const test = async () => {
    const outcome = await sendTestAlert();
    if (outcome.status === 'sent') {
      const reached = outcome.pushed + outcome.texted;
      Alert.alert(
        'Test sent',
        `${reached} ${reached === 1 ? 'person' : 'people'} should get a message marked TEST. Ask them if it arrived.`,
      );
    } else if (outcome.status === 'too-soon') {
      Alert.alert('Sent recently', 'You can send one test alert an hour.');
    } else if (outcome.status === 'demo') {
      Alert.alert(
        'Demo mode',
        "You're on demo data, so nothing was sent. With a real account, everyone on this list gets a message marked TEST.",
      );
    } else {
      Alert.alert("Couldn't send the test", 'Check your connection and try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.round} onPress={goBack} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="chevronLeft" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.flex}>
          <Text style={styles.title}>Trusted contacts</Text>
          <Text style={styles.subtitle}>
            {contacts.length} of {MAX_CONTACTS} ·{' '}
            {contacts.length === 0 ? 'people who get your SOS' : 'SOS offers to call them in this order'}
          </Text>
        </View>
        {contacts.length > 0 && !full && (
          <TouchableOpacity
            style={[styles.round, styles.add]}
            onPress={() => router.push('/contact-edit')}
            accessibilityRole="button"
            accessibilityLabel="Add a trusted contact"
          >
            <Icon name="add" size={22} color={theme.textOnColor} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {contacts.length === 0 && !isLoading ? (
          <>
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <Icon name="shield" size={26} color={theme.accent} />
              </View>
              <Text style={styles.heroTitle}>Who should we call if you need help?</Text>
              <Text style={styles.heroBody}>Add 2–3 people you trust. They don't need the app.</Text>
            </View>

            {suggestions.length > 0 && (
              <>
                <Text style={styles.label}>SUGGESTED FROM YOUR FAMILY</Text>
                <View style={styles.card}>
                  {suggestions.map((m, i) => (
                    <View key={m.id} style={[styles.row, i > 0 && styles.divider]}>
                      <View style={[styles.avatar, { backgroundColor: identityColor(theme, m.id) }]}>
                        <Text style={styles.avatarText}>{m.displayName.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.name}>{m.displayName}</Text>
                        <Text style={styles.muted}>In your family</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.pill}
                        onPress={() => addSuggested(m.displayName, m.phoneNumber)}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${m.displayName}`}
                      >
                        <Text style={styles.pillText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        ) : (
          <>
            <View style={styles.card}>
              {contacts.map((c, i) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.row, i > 0 && styles.divider]}
                  onPress={() => router.push({ pathname: '/contact-edit', params: { contactId: c.id } })}
                  onLongPress={() => openMenu(c, i)}
                  accessibilityRole="button"
                  accessibilityLabel={`${i + 1}. ${c.name}, ${c.relationship}. ${contactBadges(c).join(', ')}`}
                  accessibilityHint="Opens their alerts. Long press to change the order."
                >
                  <Text style={styles.position}>{i + 1}</Text>
                  <View style={[styles.avatar, { backgroundColor: identityColor(theme, c.id) }]}>
                    <Text style={styles.avatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.name} numberOfLines={1}>
                      {c.name} <Text style={styles.relationship}>· {c.relationship.toLowerCase()}</Text>
                    </Text>
                    <View style={styles.badges}>
                      {contactBadges(c).map((b) => (
                        <Text key={b} style={[styles.badge, b === 'SOS' ? styles.badgeSos : styles.badgeLate]}>
                          {b}
                        </Text>
                      ))}
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => openMenu(c, i)}
                    accessibilityRole="button"
                    accessibilityLabel={`Options for ${c.name}`}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Icon name="ellipsis" size={18} color={theme.textTertiary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.muted}>Tap a person to change their alerts. Press and hold to change the order.</Text>
          </>
        )}

        <WhatTheyGet smsAlertsEnabled={smsAlertsEnabled} />

        {contacts.length > 0 && (
          <TouchableOpacity style={[styles.card, styles.row]} onPress={test} accessibilityRole="button">
            <View style={styles.testIcon}>
              <Icon name="send" size={16} color={theme.textOnColor} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.name}>Send a test alert</Text>
              <Text style={styles.muted}>Check everyone gets it — marked "TEST"</Text>
            </View>
            <Icon name="chevronRight" size={16} color={theme.textTertiary} />
          </TouchableOpacity>
        )}
      </ScrollView>

      {contacts.length === 0 && !isLoading && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.footerButton, styles.footerPrimary]}
            onPress={() => router.push({ pathname: '/contact-edit', params: { pick: '1' } })}
            accessibilityRole="button"
          >
            <Icon name="person" size={18} color={theme.textOnColor} />
            <Text style={styles.footerPrimaryText}>From contacts</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.footerButton, styles.footerSecondary]}
            onPress={() => router.push('/contact-edit')}
            accessibilityRole="button"
          >
            <Text style={styles.footerSecondaryText}>Type number</Text>
          </TouchableOpacity>
        </View>
      )}
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
    round: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
    },
    add: { backgroundColor: theme.accent },
    title: { fontSize: 26, fontFamily: FONTS.headingXBold, color: theme.textPrimary },
    subtitle: { fontSize: 13, fontFamily: FONTS.body, color: theme.textSecondary },
    container: { padding: SPACING.lg, paddingTop: SPACING.sm, gap: SPACING.md, paddingBottom: SPACING.xxxl },
    hero: {
      padding: SPACING.xl,
      borderRadius: RADIUS.lg,
      backgroundColor: theme.accentMuted,
      alignItems: 'center',
      gap: SPACING.sm,
    },
    heroIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
    },
    heroTitle: { fontSize: 22, fontFamily: FONTS.headingXBold, color: theme.textPrimary, textAlign: 'center' },
    heroBody: { fontSize: 15, fontFamily: FONTS.body, color: theme.textSecondary, textAlign: 'center' },
    label: { fontSize: 12, fontFamily: FONTS.bodySemibold, letterSpacing: 0.6, color: theme.textSecondary },
    card: { borderRadius: RADIUS.lg, backgroundColor: theme.surface, paddingHorizontal: SPACING.lg },
    row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, minHeight: 64, paddingVertical: SPACING.sm },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
    position: { width: 16, fontSize: 15, fontFamily: FONTS.bodySemibold, color: theme.textSecondary },
    avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 16, fontFamily: FONTS.heading, color: theme.textOnColor },
    name: { fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    relationship: { fontFamily: FONTS.body, color: theme.textSecondary },
    muted: { fontSize: 13, fontFamily: FONTS.body, color: theme.textSecondary },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: 4 },
    badge: {
      fontSize: 12,
      fontFamily: FONTS.bodySemibold,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      borderRadius: RADIUS.pill,
      overflow: 'hidden',
    },
    badgeSos: { color: theme.critical.fg, backgroundColor: theme.critical.bg },
    badgeLate: { color: theme.warning.fg, backgroundColor: theme.warning.bg },
    pill: {
      minHeight: 36,
      paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.pill,
      justifyContent: 'center',
      backgroundColor: theme.accentMuted,
    },
    pillText: { fontSize: 15, fontFamily: FONTS.bodySemibold, color: theme.accent },
    testIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
    },
    footer: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.lg },
    footerButton: {
      flex: 1,
      minHeight: 52,
      borderRadius: RADIUS.pill,
      flexDirection: 'row',
      gap: SPACING.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footerPrimary: { backgroundColor: theme.accent },
    footerPrimaryText: { fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.textOnColor },
    footerSecondary: { backgroundColor: theme.border },
    footerSecondaryText: { fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
  });
}
