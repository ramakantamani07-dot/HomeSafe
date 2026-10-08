import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { FONTS, RADIUS, SPACING, identityColor, type ThemeColors } from '../../src/config/theme';
import { useLiveFamily, useWatchPresence } from '../../src/hooks/useFamily';
import { useGoBack } from '../../src/hooks/useGoBack';
import { useInterval } from '../../src/hooks/useInterval';
import { regionForPoints, type MapMarker } from '../../src/models/MapModels';
import { formatDistance, formatEta } from '../../src/models/RouteResult';
import { AppMapView } from '../../src/components/map/AppMapView';
import { GlassPill } from '../../src/components/glass';
import { Icon, type IconName } from '../../src/components/ui/Icon';
import { JourneyProgressBar } from '../../src/components/family/JourneyProgressBar';
import { describeAskOkOutcome, describeMemberStatus } from '../../src/components/circle/memberStatus';
import { callNumber, textNumber } from '../../src/utils/deviceLinks';

/** "updated 10 s ago" needs seconds, so this ticks faster than Family's list. */
const LIVE_TICK_MS = 5_000;

/**
 * Watching someone's journey (Option 15 S2c, "Watch live").
 *
 * Everything shown is what they published, live while this screen is open.
 * Opening it tells them, by name, that you are watching (`useWatchPresence`,
 * decision F4); their On the way screen shows it.
 *
 * Ask "OK?" pushes them a prompt; their answer arrives as a fresh "I'm OK"
 * time in what they share, so it shows in the check-in line with no reply
 * channel of its own. Until it does, the screen says when you asked — not
 * that they are fine. The road name is absent: it is not published.
 */
export default function WatchMemberScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const goBack = useGoBack();
  const insets = useSafeAreaInsets();
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const { members, askIfOk } = useLiveFamily();
  const member = members.find((m) => m.id === memberId);
  useWatchPresence(member);

  const [now, setNow] = useState(() => new Date());
  useInterval(() => setNow(new Date()), LIVE_TICK_MS);
  const [askedAt, setAskedAt] = useState<Date | null>(null);
  const [asking, setAsking] = useState(false);

  if (!member) return null;

  const name = member.displayName;
  const color = identityColor(theme, member.id);
  const path = member.routePath ?? [];
  const markers: MapMarker[] = member.location
    ? [{ id: 'member', coordinate: member.location, title: name, role: 'current' }]
    : [];
  const region = regionForPoints([...path, ...(member.location ? [member.location] : [])]);

  const secondsAgo = member.updatedAt ? Math.max(0, Math.round((now.getTime() - member.updatedAt.getTime()) / 1_000)) : null;
  const freshness =
    secondsAgo === null ? 'No update yet' : secondsAgo < 60 ? `updated ${secondsAgo} s ago` : `updated ${Math.floor(secondsAgo / 60)} min ago`;

  const eta = member.activeJourneyEta;
  const minutesLeft = eta ? Math.round((eta.getTime() - now.getTime()) / 60_000) : null;
  const details = [
    eta ? (minutesLeft !== null && minutesLeft >= 0 ? `arrives ${formatEta(eta)}` : `was due ${formatEta(eta)}`) : null,
    member.journeyProgress ? `${formatDistance(member.journeyProgress.metersRemaining)} left` : null,
  ].filter(Boolean);

  const checkIn = [
    member.lastCheckInAt ? `"I'm OK" at ${formatEta(member.lastCheckInAt)}` : null,
    member.nextCheckInAt ? `next check-in ${formatEta(member.nextCheckInAt)}` : null,
  ].filter(Boolean);

  const travelling = member.status === 'TRAVELLING';
  const answered = askedAt !== null && member.lastCheckInAt !== null && member.lastCheckInAt >= askedAt;
  const ask = async () => {
    if (asking) return;
    setAsking(true);
    const outcome = await askIfOk(member);
    setAsking(false);
    if (outcome === 'sent') {
      setAskedAt(new Date());
      return;
    }
    const message = describeAskOkOutcome(outcome, name);
    if (message) Alert.alert(message.title, message.body);
  };

  const sharingEnds = member.theirPermissions.sharingMode === 'SHARE_DURING_JOURNEY';
  // Their app listens for watchers only while they are on a journey, so the
  // line is true only then.
  const seesWatchers = member.status === 'TRAVELLING' || member.status === 'SOS_ACTIVE';
  const subline = [member.batteryLevel !== null ? `battery ${Math.round(member.batteryLevel * 100)}%` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.screen}>
      <AppMapView
        region={region}
        markers={markers}
        polyline={path.length > 1 ? { coordinates: path } : null}
      />

      <View style={[styles.topBar, { top: insets.top + SPACING.sm }]} pointerEvents="box-none">
        <GlassPill onPress={() => goBack()} accessibilityLabel="Back" style={styles.back}>
          <Icon name="chevronLeft" size={22} color={theme.textPrimary} />
        </GlassPill>
        <GlassPill>
          <View style={styles.liveRow}>
            <View style={[styles.liveDot, secondsAgo !== null && secondsAgo < 120 ? styles.liveOn : styles.liveOff]} />
            <Text style={styles.liveText}>
              {member.status === 'OFFLINE' ? 'Not sharing' : `Live · ${freshness}`}
            </Text>
          </View>
        </GlassPill>
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.md }]}>
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: color }]}>
            <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.title} numberOfLines={2}>
              {name} · {describeMemberStatus(member).toLowerCase()}
            </Text>
            {subline ? <Text style={styles.subline}>{subline}</Text> : null}
          </View>
        </View>

        {(member.journeyProgress || details.length > 0 || checkIn.length > 0) && (
          <View style={styles.card}>
            {member.journeyProgress && (
              <JourneyProgressBar fraction={member.journeyProgress.fraction} dotColor={color} />
            )}
            <View style={styles.timeRow}>
              {minutesLeft !== null && minutesLeft >= 0 && <Text style={styles.minutes}>{minutesLeft} min</Text>}
              <Text style={styles.details}>{details.join(' · ')}</Text>
            </View>
            {askedAt && !answered && (
              <Text style={styles.asked}>Asked "OK?" at {formatEta(askedAt)} — waiting for {name}</Text>
            )}
            {checkIn.length > 0 && (
              <View style={styles.checkInRow}>
                <Icon name="check" size={14} color={theme.safe.fg} />
                <Text style={styles.checkIn}>{checkIn.join(' · ')}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.actions}>
          <Action icon="call" label="Call" onPress={() => callNumber(member.phoneNumber)} tone="safe" styles={styles} theme={theme} />
          <Action icon="message" label="Message" onPress={() => textNumber(member.phoneNumber)} tone="accent" styles={styles} theme={theme} />
          {travelling && (
            <Action
              icon="check"
              label={asking ? 'Asking…' : 'Ask "OK?"'}
              onPress={ask}
              tone="warning"
              styles={styles}
              theme={theme}
            />
          )}
        </View>

        {(seesWatchers || sharingEnds) && (
          <Text style={styles.footnote}>
            {[
              seesWatchers ? `${name} can see that you're watching.` : null,
              sharingEnds ? `Sharing stops when ${name} arrives.` : null,
            ]
              .filter(Boolean)
              .join(' ')}
          </Text>
        )}
      </View>
    </View>
  );
}

function Action({
  icon,
  label,
  onPress,
  tone,
  styles,
  theme,
}: {
  icon: IconName;
  label: string;
  onPress(): void;
  tone: 'safe' | 'accent' | 'warning';
  styles: ReturnType<typeof getStyles>;
  theme: ThemeColors;
}) {
  const fg = tone === 'safe' ? theme.safe.fg : tone === 'warning' ? theme.warning.fg : theme.accent;
  const bg = tone === 'safe' ? theme.safe.bg : tone === 'warning' ? theme.warning.bg : theme.accentMuted;
  return (
    <TouchableOpacity style={[styles.action, { backgroundColor: bg }]} onPress={onPress} accessibilityRole="button">
      <Icon name={icon} size={20} color={fg} />
      <Text style={[styles.actionText, { color: fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    flex: { flex: 1 },
    topBar: { position: 'absolute', left: SPACING.lg, right: SPACING.lg, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    back: { minWidth: 44, minHeight: 44 },
    liveRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
    liveDot: { width: 8, height: 8, borderRadius: 4 },
    liveOn: { backgroundColor: theme.safe.fg },
    liveOff: { backgroundColor: theme.textTertiary },
    liveText: { fontSize: 14, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      padding: SPACING.lg,
      gap: SPACING.md,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      backgroundColor: theme.surface,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 17, fontFamily: FONTS.heading, color: theme.textOnColor },
    title: { fontSize: 20, fontFamily: FONTS.headingXBold, color: theme.textPrimary },
    subline: { fontSize: 14, fontFamily: FONTS.body, color: theme.textSecondary },
    card: { padding: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: theme.background, gap: SPACING.sm },
    timeRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SPACING.md },
    minutes: { fontSize: 26, fontFamily: FONTS.headingXBold, color: theme.textPrimary },
    details: { flexShrink: 1, fontSize: 14, fontFamily: FONTS.body, color: theme.textSecondary, textAlign: 'right' },
    checkInRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
    checkIn: { fontSize: 14, fontFamily: FONTS.bodySemibold, color: theme.safe.fg },
    asked: { fontSize: 14, fontFamily: FONTS.body, color: theme.warning.fg },
    actions: { flexDirection: 'row', gap: SPACING.sm },
    action: {
      flex: 1,
      minHeight: 64,
      borderRadius: RADIUS.lg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
    },
    actionText: { fontSize: 15, fontFamily: FONTS.bodySemibold },
    footnote: { textAlign: 'center', fontSize: 13, fontFamily: FONTS.body, color: theme.textSecondary },
  });
}
