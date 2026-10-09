import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../src/config/theme';
import { useContacts } from '../../src/hooks/useContacts';
import { useFamily } from '../../src/hooks/useFamily';
import { useGoBack } from '../../src/hooks/useGoBack';
import {
  CONTACT_RELATIONSHIPS,
  DEFAULT_CONTACT_ALERTS,
  type ContactAlerts,
  type ContactRelationship,
} from '../../src/models/Contact';
import { normaliseContactNumber } from '../../src/models/Family';
import { PhoneInput } from '../../src/components/common/PhoneInput';
import { Button } from '../../src/components/ui/Button';
import { Icon, type IconName } from '../../src/components/ui/Icon';

const E164 = /^\+[1-9]\d{6,14}$/;

/**
 * Add or edit a trusted contact (trust board "Add trusted contact").
 *
 * "Alert Anita when…" is new: SOS is locked on — a contact who could not be
 * told about an SOS would not be a trusted contact — while missed check-ins
 * and journey starts are theirs to choose, and the server honours each.
 *
 * "We'll text Anita…" appears only where texting is live, and never assumes
 * a pronoun.
 */
export default function ContactEditScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const goBack = useGoBack();
  const { contactId, pick } = useLocalSearchParams<{ contactId?: string; pick?: string }>();
  const { contacts, addContact, updateContact, deleteContact, smsAlertsEnabled } = useContacts();
  const { canPickContacts, pickContact } = useFamily();
  const existing = contacts.find((c) => c.id === contactId);

  const [name, setName] = useState(existing?.name ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [phoneKey, setPhoneKey] = useState(0);
  const [relationship, setRelationship] = useState<ContactRelationship | null>(existing?.relationship ?? null);
  const [alerts, setAlerts] = useState<ContactAlerts>(existing?.alerts ?? DEFAULT_CONTACT_ALERTS);
  const [saving, setSaving] = useState(false);

  const first = name.trim().split(' ')[0];
  const who = first || 'them';
  const ready = name.trim().length > 0 && E164.test(phone) && relationship !== null;

  const choose = async () => {
    const contact = await pickContact();
    if (!contact) return;
    const number = contact.phoneNumbers.map(normaliseContactNumber).find((n): n is string => n !== null);
    setName(contact.name);
    if (number) {
      setPhone(number);
      setPhoneKey((k) => k + 1);
    } else {
      Alert.alert(`No number we can use for ${contact.name || 'them'}`, 'Type their mobile number, with its country code.');
    }
  };

  // "From contacts" on the empty list opens the picker straight away.
  const pickedOnOpen = useRef(false);
  useEffect(() => {
    if (pick === '1' && !pickedOnOpen.current && canPickContacts) {
      pickedOnOpen.current = true;
      void choose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick, canPickContacts]);

  const save = async () => {
    if (!ready || !relationship) return;
    setSaving(true);
    try {
      if (existing) {
        await updateContact(existing.id, { name, phone, relationship, alerts });
      } else {
        await addContact({ name, phone, relationship, alerts });
      }
      goBack();
    } catch (err) {
      Alert.alert("Couldn't save", err instanceof Error ? err.message : 'Try again in a moment.');
      setSaving(false);
    }
  };

  const remove = () =>
    existing &&
    Alert.alert(`Remove ${existing.name}?`, "They won't be told if you press SOS or miss a check-in.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteContact(existing.id);
          goBack();
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} accessibilityRole="button" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{existing ? existing.name : 'Add trusted contact'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {!existing && canPickContacts && (
            <TouchableOpacity style={styles.contacts} onPress={choose} accessibilityRole="button">
              <Icon name="person" size={18} color={theme.accent} />
              <Text style={styles.contactsText}>Choose from contacts</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Their name"
            placeholderTextColor={theme.textTertiary}
            autoCapitalize="words"
            maxLength={100}
            accessibilityLabel="Name"
          />

          <Text style={styles.label}>Mobile number</Text>
          <PhoneInput key={phoneKey} initialValue={phone || undefined} onPhoneChange={setPhone} />

          <Text style={styles.label}>Who is {first || 'this person'} to you?</Text>
          <View style={styles.chips}>
            {CONTACT_RELATIONSHIPS.map((r) => {
              const selected = r === relationship;
              return (
                <TouchableOpacity
                  key={r}
                  style={[styles.chip, selected && styles.chipOn]}
                  onPress={() => setRelationship(r)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  {selected && <Icon name="check" size={14} color={theme.textOnColor} />}
                  <Text style={[styles.chipText, selected && styles.chipTextOn]}>{r}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Alert {who} when…</Text>
          <View style={styles.card}>
            <AlertRow icon="warning" tint={theme.critical.fg} title="I press SOS" detail="Live location and an alert" styles={styles} theme={theme}>
              <View style={styles.locked} accessibilityLabel="Always on">
                <Icon name="lock" size={12} color={theme.textSecondary} />
                <Text style={styles.lockedText}>Always</Text>
              </View>
            </AlertRow>
            <AlertRow icon="time" tint={theme.warning.fg} title="I miss a check-in" detail="Only if I don't reply" styles={styles} theme={theme} divider>
              <Switch
                value={alerts.missedCheckIn}
                onValueChange={(v) => setAlerts({ ...alerts, missedCheckIn: v })}
                trackColor={{ true: theme.safe.fg, false: theme.border }}
                accessibilityLabel={`Alert ${who} when I miss a check-in`}
              />
            </AlertRow>
            <AlertRow icon="navigate" tint={theme.safe.fg} title="I start a journey" detail="Optional" styles={styles} theme={theme} divider>
              <Switch
                value={alerts.journeyStart}
                onValueChange={(v) => setAlerts({ ...alerts, journeyStart: v })}
                trackColor={{ true: theme.safe.fg, false: theme.border }}
                accessibilityLabel={`Alert ${who} when I start a journey`}
              />
            </AlertRow>
          </View>

          {existing && (
            <TouchableOpacity onPress={remove} accessibilityRole="button" style={styles.remove}>
              <Text style={styles.removeText}>Remove {existing.name}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={existing ? 'Save' : first ? `Add ${first}` : 'Add contact'}
            variant="primary"
            onPress={save}
            disabled={!ready}
            loading={saving}
          />
          {!existing && smsAlertsEnabled && (
            <Text style={styles.footnote}>We'll text {who} to let them know you added them.</Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AlertRow({
  icon,
  tint,
  title,
  detail,
  divider,
  children,
  styles,
  theme,
}: {
  icon: IconName;
  tint: string;
  title: string;
  detail: string;
  divider?: boolean;
  children: React.ReactNode;
  styles: ReturnType<typeof getStyles>;
  theme: ThemeColors;
}) {
  return (
    <View style={[styles.alertRow, divider && styles.divider]}>
      <View style={[styles.alertIcon, { backgroundColor: tint }]}>
        <Icon name={icon} size={16} color={theme.textOnColor} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.alertTitle}>{title}</Text>
        <Text style={styles.alertDetail}>{detail}</Text>
      </View>
      {children}
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
    },
    cancel: { fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.accent, minWidth: 60 },
    title: { fontSize: 17, fontFamily: FONTS.heading, color: theme.textPrimary },
    headerSpacer: { minWidth: 60 },
    container: { padding: SPACING.lg, paddingTop: 0, gap: SPACING.sm, paddingBottom: SPACING.xxxl },
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
    label: { fontSize: 13, fontFamily: FONTS.bodySemibold, color: theme.textSecondary, marginTop: SPACING.sm },
    input: {
      padding: SPACING.md,
      borderRadius: RADIUS.lg,
      backgroundColor: theme.surface,
      fontSize: 17,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      minHeight: 40,
      paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.pill,
      backgroundColor: theme.surface,
    },
    chipOn: { backgroundColor: theme.accent },
    chipText: { fontSize: 15, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    chipTextOn: { color: theme.textOnColor },
    card: { borderRadius: RADIUS.lg, backgroundColor: theme.surface, paddingHorizontal: SPACING.lg },
    alertRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, minHeight: 60, paddingVertical: SPACING.sm },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
    alertIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    alertTitle: { fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    alertDetail: { fontSize: 13, fontFamily: FONTS.body, color: theme.textSecondary },
    locked: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    lockedText: { fontSize: 14, fontFamily: FONTS.bodySemibold, color: theme.textSecondary },
    remove: { alignItems: 'center', paddingVertical: SPACING.lg },
    removeText: { fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.critical.fg },
    footer: { padding: SPACING.lg, gap: SPACING.sm },
    footnote: { textAlign: 'center', fontSize: 13, fontFamily: FONTS.body, color: theme.textSecondary },
  });
}
