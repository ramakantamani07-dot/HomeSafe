import React, { useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { ELEVATION, FONTS, RADIUS, SPACING, type ThemeColors } from '../../src/config/theme';
import { useBasicPhoneMembers } from '../../src/hooks/useBasicPhoneMembers';
import {
  MEMBER_MARKET_LABEL,
  canSendRequest,
  normaliseMemberNumber,
} from '../../src/models/BasicPhoneMember';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Button } from '../../src/components/ui/Button';
import { Icon } from '../../src/components/ui/Icon';
import { BasicPhoneExplainer } from '../../src/components/circle/BasicPhoneExplainer';

type PhoneType = 'app' | 'basic';

/**
 * Add someone (Option 15 S4).
 *
 * Smartphone members are invited through the existing two-sided flow; this
 * screen hands them over to it rather than duplicating it. Basic-phone members
 * are added here, and adding them *is* the consent request — nothing is shared
 * until they reply YES and their network agrees.
 *
 * The board shows an operator lookup ("EE · supported"). There is no lookup to
 * call until an operator aggregator is chosen (G3), so the chip names only what
 * the number itself tells us — which country's mobile it is. Claiming support
 * we have not checked would be the first untrue thing this person read.
 */
export default function AddSomeoneScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string; phone?: string }>();
  const { addMember, enabled } = useBasicPhoneMembers();

  // With basic-phone finding off in this build, only the app path exists.
  const [phoneType, setPhoneType] = useState<PhoneType>(enabled ? 'basic' : 'app');
  const [name, setName] = useState(params.name ?? '');
  const [phone, setPhone] = useState(params.phone ?? '');
  const [minor, setMinor] = useState(false);
  const [guardianAttested, setGuardianAttested] = useState(false);
  const [sending, setSending] = useState(false);

  const parsed = normaliseMemberNumber(phone);
  const who = name.trim() || 'them';
  const ready = canSendRequest({ displayName: name, phoneNumber: phone, minor, guardianAttested });

  const send = async () => {
    if (!parsed || !ready) return;
    setSending(true);
    try {
      const member = await addMember({
        displayName: name.trim(),
        phoneNumber: parsed.e164,
        minor,
        guardianAttested: minor && guardianAttested,
      });
      router.replace({ pathname: '/basic-member', params: { memberId: member.id } });
    } catch {
      Alert.alert(
        "Couldn't send the request",
        'Nothing was sent. Check your connection and try again.',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="Add someone" onBack={() => router.back()} />

          <View style={styles.card}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Who are you adding?"
              placeholderTextColor={theme.textTertiary}
              autoCapitalize="words"
              accessibilityLabel="Name"
            />
            <View style={styles.divider} />
            <Text style={styles.label}>Mobile number</Text>
            <View style={styles.phoneRow}>
              <TextInput
                style={[styles.input, styles.flex]}
                value={phone}
                onChangeText={setPhone}
                placeholder="07700 900123"
                placeholderTextColor={theme.textTertiary}
                keyboardType="phone-pad"
                accessibilityLabel="Mobile number"
              />
              {parsed && (
                <View style={styles.marketChip}>
                  <Text style={styles.marketText}>{MEMBER_MARKET_LABEL[parsed.market]}</Text>
                </View>
              )}
            </View>
            {phone.length >= 6 && !parsed && (
              <Text style={styles.hint}>
                Basic-phone finding works with UK and Indian mobile numbers.
              </Text>
            )}
          </View>

          <Text style={styles.sectionLabel}>{name.trim() ? `${name.trim()}'s phone` : 'Their phone'}</Text>
          {enabled && (
          <View style={styles.segments}>
            {(['app', 'basic'] as const).map((type) => {
              const selected = phoneType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.segment, selected && styles.segmentSelected]}
                  onPress={() => setPhoneType(type)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                    {type === 'app' ? 'Smartphone (app)' : 'Basic phone'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          )}

          {phoneType === 'app' ? (
            <View style={styles.card}>
              <Text style={styles.body}>
                With a smartphone, they use wayLoc too. You send an invitation, and each of you
                chooses what the other can see.
              </Text>
              <Button
                label="Invite to wayLoc"
                variant="secondary"
                onPress={() => router.replace('/family-invite')}
              />
            </View>
          ) : (
            <>
              <BasicPhoneExplainer name={name} />

              <View style={styles.card}>
                <View style={styles.toggleRow}>
                  <Text style={[styles.body, styles.flex]}>{name.trim() || 'They'} is under 18</Text>
                  <Switch
                    value={minor}
                    onValueChange={(v) => {
                      setMinor(v);
                      if (!v) setGuardianAttested(false);
                    }}
                    accessibilityLabel="Under 18"
                  />
                </View>
                {minor && (
                  <TouchableOpacity
                    style={styles.tickRow}
                    onPress={() => setGuardianAttested((v) => !v)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: guardianAttested }}
                  >
                    <View style={[styles.tick, guardianAttested && styles.tickOn]}>
                      {guardianAttested && <Icon name="check" size={16} color={theme.textOnColor} />}
                    </View>
                    <Text style={[styles.body, styles.flex]}>
                      I'm {who}'s parent or legal guardian, and I give consent on their behalf too.
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </ScrollView>

        {phoneType === 'basic' && (
          <View style={styles.footer}>
            <Button
              label={name.trim() ? `Send request to ${name.trim()}` : 'Send request'}
              icon="message"
              variant="primary"
              onPress={send}
              disabled={!ready}
              loading={sending}
            />
            <Text style={styles.footnote}>Nothing is shared until {who} says YES.</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    flex: { flex: 1 },
    container: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
    card: { padding: SPACING.lg, borderRadius: RADIUS.lg, backgroundColor: theme.surface, gap: SPACING.sm },
    label: { fontSize: 13, fontFamily: FONTS.body, color: theme.textSecondary },
    input: { fontSize: 18, fontFamily: FONTS.bodySemibold, color: theme.textPrimary, paddingVertical: SPACING.xs },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginVertical: SPACING.xs },
    phoneRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    marketChip: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.pill,
      backgroundColor: theme.safe.bg,
    },
    marketText: { fontSize: 12, fontFamily: FONTS.bodySemibold, color: theme.safe.fg },
    hint: { fontSize: 13, fontFamily: FONTS.body, color: theme.warning.fg },
    sectionLabel: { fontSize: 13, fontFamily: FONTS.body, color: theme.textSecondary, marginTop: SPACING.xs },
    segments: {
      flexDirection: 'row',
      gap: SPACING.xs,
      padding: SPACING.xs,
      borderRadius: RADIUS.pill,
      backgroundColor: theme.border,
    },
    segment: { flex: 1, minHeight: 44, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
    segmentSelected: { backgroundColor: theme.surface, ...ELEVATION.xs },
    segmentText: { fontSize: 15, fontFamily: FONTS.bodySemibold, color: theme.textSecondary },
    segmentTextSelected: { color: theme.textPrimary },
    body: { fontSize: 15, lineHeight: 21, fontFamily: FONTS.body, color: theme.textPrimary },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, minHeight: 44 },
    tickRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, minHeight: 44, paddingTop: SPACING.xs },
    tick: {
      width: 24,
      height: 24,
      borderRadius: RADIUS.sm,
      borderWidth: 2,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tickOn: { backgroundColor: theme.accent, borderColor: theme.accent },
    footer: { padding: SPACING.lg, gap: SPACING.sm },
    footnote: { textAlign: 'center', fontSize: 13, fontFamily: FONTS.body, color: theme.textSecondary },
  });
}
