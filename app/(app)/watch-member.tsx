import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { FONTS, RADIUS, SPACING, identityColor, type ThemeColors } from '../../src/config/theme';
import { useLiveFamily } from '../../src/hooks/useFamily';
import { useInterval } from '../../src/hooks/useInterval';
import { regionForPoints, type MapMarker } from '../../src/models/MapModels';
import { formatDistance, formatEta } from '../../src/models/RouteResult';
import { AppMapView } from '../../src/components/map/AppMapView';
import { GlassPill } from '../../src/components/glass';
import { Icon, type IconName } from '../../src/components/ui/Icon';
import { JourneyProgressBar } from '../../src/components/family/JourneyProgressBar';
import { describeMemberStatus } from '../../src/components/circle/memberStatus';
import { callNumber, textNumber } from '../../src/utils/deviceLinks';

/** "updated 10 s ago" needs seconds, so this ticks faster than Family's list. */
const LIVE_TICK_MS = 5_000;

/**
 * Watching someone's journey (Option 15 S2c, "Watch live").
 *
 * Everything shown is what they published, live while this screen is open.
 * Two board elements wait on later Phase 5b steps and are absent until then,
 * because each would be a claim nothing yet backs:
 *  - "Ask OK?" — needs the check-in prompt function (step 5);
 *  - "Emma can see that you're watching" — needs the watcher record (step 4).
 * The road name is absent too: it is not published.
 */
export default function WatchMemberScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const { members } = useLiveFamily();
  const member = members.find((m) => m.id === memberId);

  const [now, setNow] = useState(() => new Date());
  useInterval(() => setNow(new Date()), LIVE_TICK_MS);

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

  const sharingEnds = member.theirPermissions.sharingMode === 'SHARE_DURING_JOURNEY';
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
        <GlassPill onPress={() => router.back()} accessibilityLabel="Back" style={styles.back}>
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
        </View>

        {sharingEnds && <Text style={styles.footnote}>Sharing stops when {name} arrives.</Text>}
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
  tone: 'safe' | 'accent';
  styles: ReturnType<typeof getStyles>;
  theme: ThemeColors;
}) {
  const fg = tone === 'safe' ? theme.safe.fg : theme.accent;
  const bg = tone === 'safe' ? theme.safe.bg : theme.accentMuted;
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
