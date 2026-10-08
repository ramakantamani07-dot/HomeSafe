import React, { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { FONTS, RADIUS, SPACING, identityColor, type ThemeColors } from '../../src/config/theme';
import { useLiveFamily } from '../../src/hooks/useFamily';
import { useGoBack } from '../../src/hooks/useGoBack';
import { useInterval } from '../../src/hooks/useInterval';
import { SHARING_MODE_LABELS, type FamilyPermissions, type SharingMode } from '../../src/models/Family';
import { formatEta } from '../../src/models/RouteResult';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Section, ListRow } from '../../src/components/ui/Section';
import { Button } from '../../src/components/ui/Button';
import { Icon, type IconName } from '../../src/components/ui/Icon';
import { describeAge, describeMemberStatus } from '../../src/components/circle/memberStatus';
import { callNumber, textNumber } from '../../src/utils/deviceLinks';

const SHARING_MODES: SharingMode[] = ['SHARE_ALWAYS', 'SHARE_DURING_JOURNEY', 'NEVER_SHARE'];

const PERMISSION_TOGGLES: [keyof FamilyPermissions, string][] = [
  ['shareLocation', 'Location'],
  ['shareJourneyDetails', 'Journey details'],
  ['shareBattery', 'Battery level'],
  ['shareStatus', 'Status'],
];

/** "Updated 2 min ago" re-reads the clock while the screen is open. */
const CLOCK_TICK_MS = 30_000;

/**
 * One app member (Option 15 style; no board of its own — it follows S2b and
 * S2c). Live while open. Someone on a journey gets **Watch live**, which shows
 * the journey properly; this screen no longer duplicates it.
 *
 * Below the person: what *you* share with them, the one thing here you
 * control. What they share with you is theirs to set.
 */
export default function FamilyMemberScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();
  const goBack = useGoBack();
  const { connectionId } = useLocalSearchParams<{ connectionId: string }>();
  const { members, removeMember, updatePermissions } = useLiveFamily();
  const member = members.find((m) => m.connectionId === connectionId);

  const [now, setNow] = useState(() => new Date());
  useInterval(() => setNow(new Date()), CLOCK_TICK_MS);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<FamilyPermissions | null>(null);

  if (!member) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.container}>
          <ScreenHeader title="Not found" onBack={goBack} />
          <Text style={styles.muted}>This person is no longer in your family.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const name = member.displayName;
  const first = name.split(' ')[0];
  const perms = draft ?? member.myPermissions;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(member.myPermissions);
  const travelling = member.status === 'TRAVELLING' || member.status === 'SOS_ACTIVE';
  const age = describeAge(member.updatedAt, now);
  const battery = member.batteryLevel != null ? Math.round(member.batteryLevel * 100) : null;

  const setPerm = <K extends keyof FamilyPermissions>(key: K, value: FamilyPermissions[K]) =>
    setDraft({ ...perms, [key]: value });

  const save = async () => {
    if (!draft) return;
    setIsSaving(true);
    try {
      await updatePermissions(member.connectionId, draft);
      setDraft(null);
    } catch {
      Alert.alert("Couldn't save", 'Your sharing settings did not change. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = () =>
    Alert.alert(`Remove ${name}?`, `You'll stop seeing each other's journeys and status.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setIsRemoving(true);
          try {
            await removeMember(member.connectionId);
            goBack();
          } catch {
            Alert.alert("Couldn't remove", 'Check your connection and try again.');
            setIsRemoving(false);
          }
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader title={name} onBack={goBack} />

        <View style={styles.card}>
          <View style={styles.personRow}>
            <View style={[styles.avatar, { backgroundColor: identityColor(theme, member.id) }]}>
              <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.name}>
                {name}
                {member.relationship ? <Text style={styles.muted}> · {member.relationship.toLowerCase()}</Text> : null}
              </Text>
              <Text style={styles.muted}>{member.phoneNumber}</Text>
            </View>
          </View>
          <View style={styles.actions}>
            <Action icon="call" label="Call" tone="safe" onPress={() => callNumber(member.phoneNumber)} styles={styles} theme={theme} />
            <Action icon="message" label="Message" tone="accent" onPress={() => textNumber(member.phoneNumber)} styles={styles} theme={theme} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={[styles.status, member.status === 'SOS_ACTIVE' && styles.statusSos]}>
            {describeMemberStatus(member)}
          </Text>
          <Text style={styles.muted}>
            {[
              age && member.status !== 'OFFLINE' ? `Updated ${age}` : null,
              battery !== null ? `battery ${battery}%` : null,
              travelling && member.activeJourneyEta ? `arrives ${formatEta(member.activeJourneyEta)}` : null,
            ]
              .filter(Boolean)
              .join(' · ') || `${first} isn't sharing their status with you`}
          </Text>
          {travelling ? (
            <Button
              label="Watch live"
              variant="primary"
              onPress={() => router.push({ pathname: '/watch-member', params: { memberId: member.id } })}
            />
          ) : member.location ? (
            <TouchableOpacity
              style={styles.mapLink}
              onPress={() => {
                const { latitude, longitude } = member.location!;
                Linking.openURL(`https://maps.google.com/?q=${latitude},${longitude}`).catch(() => {});
              }}
              accessibilityRole="link"
            >
              <Icon name="location" size={16} color={theme.accent} />
              <Text style={styles.mapLinkText}>See where on the map</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Section title={`What you share with ${first}`}>
          {SHARING_MODES.map((mode) => (
            <ListRow
              key={mode}
              title={SHARING_MODE_LABELS[mode]}
              onPress={() => setPerm('sharingMode', mode)}
              accessory={
                perms.sharingMode === mode ? <Icon name="check" size={18} color={theme.accent} /> : <View />
              }
            />
          ))}
        </Section>

        {perms.sharingMode !== 'NEVER_SHARE' && (
          <Section title="Including">
            {PERMISSION_TOGGLES.map(([key, label]) => (
              <ListRow
                key={key}
                title={label}
                accessory={
                  <Switch
                    value={perms[key] as boolean}
                    onValueChange={(v) => setPerm(key, v)}
                    trackColor={{ true: theme.accent, false: theme.border }}
                    thumbColor={theme.textOnColor}
                    accessibilityLabel={`Share ${label.toLowerCase()} with ${first}`}
                  />
                }
              />
            ))}
          </Section>
        )}

        {dirty && <Button label="Save sharing settings" variant="primary" onPress={save} loading={isSaving} />}

        <Button label={`Remove ${first}`} variant="destructive" onPress={remove} loading={isRemoving} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({
  icon,
  label,
  tone,
  onPress,
  styles,
  theme,
}: {
  icon: IconName;
  label: string;
  tone: 'safe' | 'accent';
  onPress(): void;
  styles: ReturnType<typeof getStyles>;
  theme: ThemeColors;
}) {
  const fg = tone === 'safe' ? theme.safe.fg : theme.accent;
  const bg = tone === 'safe' ? theme.safe.bg : theme.accentMuted;
  return (
    <TouchableOpacity style={[styles.action, { backgroundColor: bg }]} onPress={onPress} accessibilityRole="button">
      <Icon name={icon} size={18} color={fg} />
      <Text style={[styles.actionText, { color: fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    flex: { flex: 1 },
    container: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
    card: { padding: SPACING.lg, borderRadius: RADIUS.lg, backgroundColor: theme.surface, gap: SPACING.md },
    personRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 20, fontFamily: FONTS.heading, color: theme.textOnColor },
    name: { fontSize: 18, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    muted: { fontSize: 14, fontFamily: FONTS.body, color: theme.textSecondary },
    actions: { flexDirection: 'row', gap: SPACING.sm },
    action: {
      flex: 1,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      borderRadius: RADIUS.pill,
    },
    actionText: { fontSize: 15, fontFamily: FONTS.bodySemibold },
    status: { fontSize: 18, fontFamily: FONTS.headingXBold, color: theme.textPrimary },
    statusSos: { color: theme.critical.fg },
    mapLink: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, minHeight: 44 },
    mapLinkText: { fontSize: 15, fontFamily: FONTS.bodySemibold, color: theme.accent },
  });
}
