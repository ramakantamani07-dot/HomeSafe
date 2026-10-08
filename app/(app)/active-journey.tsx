import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { ELEVATION, FONTS, RADIUS, SPACING, type ThemeColors } from '../../src/config/theme';
import { useJourney } from '../../src/hooks/useJourney';
import { useSafetyCheck } from '../../src/hooks/useSafetyCheck';
import { useFamily } from '../../src/hooks/useFamily';
import { useBatteryStatus } from '../../src/hooks/useBatteryStatus';
import { useActiveJourneyLocation } from '../../src/hooks/useActiveJourneyLocation';
import { useJourneyMap } from '../../src/hooks/useJourneyMap';
import { useRoute } from '../../src/hooks/useRoute';
import { useCheckIn } from '../../src/hooks/useCheckIn';
import { useAndroidBack } from '../../src/hooks/useAndroidBack';
import { AppMapView } from '../../src/components/map/AppMapView';
import { LowBatteryBanner } from '../../src/components/common/LowBatteryBanner';
import { Icon, type IconName } from '../../src/components/ui/Icon';
import { Button } from '../../src/components/ui/Button';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
import { GlassPill, SafetyDock } from '../../src/components/glass';
import { TurnBanner } from '../../src/components/journey/TurnBanner';
import { EtaCapsule } from '../../src/components/journey/EtaCapsule';
import { UneasyPill } from '../../src/components/journey/UneasyPill';
import { joinGuardianNames } from '../../src/utils/guardians';
import { SAFETY_CHECK_EXTENSION_MINUTES } from '../../src/models/SafetyCheck';
import { currentLeg, formatDistance } from '../../src/models/RouteResult';
import { haptics } from '../../src/utils/haptics';

/** When the check-in ring turns amber — the last two minutes of the window. */
const CHECK_IN_URGENT_SECONDS = 120;

function formatClockTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Freshness, stated honestly.
 *
 * JOURNEY_FLOW_SPEC §3 is explicit: if the last location update is older than
 * 2 minutes, show "Last updated X min ago" in amber — never "Live". A status
 * line that claims to be live when it isn't is worse than no status line,
 * because it's the one thing a guardian would act on.
 */
function freshnessFor(
  isTracking: boolean,
  lastUpdateAt: Date | null,
): { label: string; stale: boolean } {
  if (!isTracking || !lastUpdateAt) return { label: 'Waiting for location', stale: true };
  const minutes = Math.floor((Date.now() - lastUpdateAt.getTime()) / 60_000);
  if (minutes < 2) return { label: 'on route', stale: false };
  if (minutes < 60) return { label: `Last updated ${minutes} min ago`, stale: true };
  return { label: `Last updated ${Math.floor(minutes / 60)} h ago`, stale: true };
}

/**
 * Screen 06 — "On the way".
 *
 * Map with a docked summary sheet. Back goes to Home (07) and deliberately
 * does NOT end the journey — per the spec, ending only ever happens by
 * arriving, tapping "I've arrived", or an explicit "End journey" with a
 * confirmation.
 */
export default function ActiveJourneyScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { activeJourney, isLoading, endJourney, cancelJourney, shareJourney } = useJourney();
  const {
    isTracking,
    currentLocation,
    lastLocationUpdateAt,
    arrivalDetected,
    backgroundPermissionRevoked,
    dismissPermissionWarning,
  } = useActiveJourneyLocation();
  const mapData = useJourneyMap();
  const { route, formattedEta, formattedDistance, eta, isLoading: routeLoading } = useRoute();
  const { addTime, adjustedEta } = useSafetyCheck();
  const { phase: checkInPhase, timeRemainingSeconds, confirmSafe } = useCheckIn();
  const { members } = useFamily();
  const { batteryPercent } = useBatteryStatus();

  const [ending, setEnding] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [sharing, setSharing] = useState(false);

  // "Last updated N min ago" has to advance on its own — a frozen freshness
  // label is indistinguishable from a fresh one, which is exactly the lie
  // this indicator exists to prevent.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const guardians = useMemo(() => joinGuardianNames(members), [members]);

  // Spec §3: "06 Back does NOT end the journey. It goes to 07." The nav stack
  // would otherwise unwind into the destination picker this journey was
  // started from.
  const goHome = useCallback(() => router.replace('/(app)/home'), [router]);
  useAndroidBack(goHome);

  /**
   * Ends the journey and hands its summary to screen 10.
   *
   * Idempotent via finishingRef: both the "I've arrived" button and the
   * automatic arrival detector call this, and they can fire within the same
   * second of each other. Ending twice would double-write the journey status
   * and could push two Arrived screens.
   */
  const finishingRef = useRef(false);
  const finishJourney = useCallback(
    async ({ endedEarly = false }: { endedEarly?: boolean } = {}) => {
    if (finishingRef.current || !activeJourney) return;
    finishingRef.current = true;
    setEnding(true);

    try {
      const ended = await endJourney();
      const source = ended ?? activeJourney;
      const durationMinutes = Math.max(
        1,
        Math.round((Date.now() - source.startedAt.getTime()) / 60_000),
      );

      router.replace({
        pathname: '/(app)/arrived',
        params: {
          name: source.destination?.name ?? source.destinationLabel,
          address: source.destination?.formattedAddress ?? '',
          postcode: source.destination?.postcode ?? '',
          placeId: source.destination?.placeId ?? '',
          journeyId: source.id,
          arrivedAt: String(Date.now()),
          durationMinutes: String(durationMinutes),
          distanceMeters:
            source.routeDistanceMeters !== null ? String(source.routeDistanceMeters) : '',
          alerts: '0',
          lat: source.destinationCoordinates
            ? String(source.destinationCoordinates.latitude)
            : '',
          lng: source.destinationCoordinates
            ? String(source.destinationCoordinates.longitude)
            : '',
          // A journey started from a saved place is already saved, so screen
          // 10 shouldn't offer to save it again.
          alreadySaved: source.savedPlaceId ? 'true' : 'false',
          // Lets AI6 say what actually happened instead of congratulating
          // someone on arriving somewhere they never reached.
          endedEarly: endedEarly ? 'true' : 'false',
        },
      });
    } catch {
      // Let them try again rather than stranding a journey that's still
      // running and still sharing.
      finishingRef.current = false;
      Alert.alert('Error', "Couldn't end the journey. Please try again.");
    } finally {
      setEnding(false);
    }
    },
    [activeJourney, endJourney, router],
  );

  // Auto-detected arrival opens screen 10 by itself, per the spec's
  // "10 Arrived opens itself when within 100 m of the destination".
  useEffect(() => {
    if (arrivalDetected) void finishJourney();
  }, [arrivalDetected, finishJourney]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!activeJourney) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Icon name="compass" size={56} color={theme.textTertiary} />
          <Text style={styles.emptyTitle}>No journey running</Text>
          <Text style={styles.emptyDesc}>Start one from Home to follow it here.</Text>
          <Button
            label="Go Home"
            variant="strong"
            onPress={() => router.replace('/(app)/home')}
            fullWidth={false}
          />
        </View>
      </SafeAreaView>
    );
  }

  const journey = activeJourney;
  const destinationName = journey.destination?.name ?? journey.destinationLabel;
  const freshness = freshnessFor(isTracking, lastLocationUpdateAt);
  const displayEta = adjustedEta ?? eta;

  const minutesRemaining = displayEta
    ? Math.max(0, Math.round((displayEta.getTime() - Date.now()) / 60_000))
    : null;

  // 0–1 through the journey by elapsed time against the planned arrival, so
  // the bar still moves when the route can't be recalculated.
  const progress = (() => {
    if (!displayEta) return 0;
    const total = displayEta.getTime() - journey.startedAt.getTime();
    if (total <= 0) return 1;
    return Math.min(1, Math.max(0, (Date.now() - journey.startedAt.getTime()) / total));
  })();

  // The road under the traveller right now. Context, not navigation — see
  // currentLeg()'s note on why there is no direction arrow.
  const leg = currentLeg(route, currentLocation);
  const legName = leg?.name ?? null;
  const remainingDistance =
    route && route.distanceMeters > 0 ? formatDistance(route.distanceMeters) : null;

  /**
   * The check-in ring: 1 is a full window, 0 is out of time.
   *
   * Anchored to the journey's own check-in interval rather than a fixed span,
   * because that interval is a per-journey preference. With no active window
   * the ring reads full, which is the honest picture — nothing is counting down.
   */
  const checkInWindowSeconds = Math.max(
    1,
    (journey.checkInIntervalMinutes ?? 0) * 60,
  );
  const checkInActive = checkInPhase !== 'inactive';
  const checkInProgress = checkInActive
    ? Math.min(1, Math.max(0, timeRemainingSeconds / checkInWindowSeconds))
    : 1;
  const checkInUrgent = checkInActive && timeRemainingSeconds <= CHECK_IN_URGENT_SECONDS;

  const firstGuardian = members.length > 0 ? members[0] : null;

  // "21:44 · NN2 8ET · check-in 4 min" — only the parts we actually know.
  const etaDetail = [
    displayEta ? formatClockTime(displayEta) : null,
    journey.destination?.postcode ?? null,
    checkInActive ? `check-in ${Math.max(0, Math.ceil(timeRemainingSeconds / 60))} min` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  /**
   * "I'm OK" — the dock's primary action while a journey runs.
   *
   * Confirms the check-in rather than merely extending the timer: those are
   * different claims, and the guardian-facing one is "they told us they are
   * fine", which only confirmSafe() makes.
   */
  const handleImOk = async () => {
    try {
      await confirmSafe();
      haptics.checkIn();
    } catch {
      Alert.alert('Error', "Couldn't send your check-in. Please try again.");
    }
  };

  /**
   * End, per §D: confirm, then hand off to `AI6` flagged as ended early.
   *
   * Deliberately not the old behaviour of dropping the user back on Home. A
   * journey that stops without an arrival is still a journey that happened, and
   * the traveller should see the same summary — and get the same chance to
   * record how the walk felt — as one that completed.
   */
  const handleEndJourney = () => {
    Alert.alert(
      'End journey?',
      `${guardians} will be told you've stopped sharing, without an arrival.`,
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'End journey',
          style: 'destructive',
          onPress: () => void finishJourney({ endedEarly: true }),
        },
      ],
    );
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const url = await shareJourney();
      setShowOptions(false);
      await Share.share({
        message: `Follow my journey to ${destinationName} on wayLoc: ${url}`,
        url,
      });
    } catch {
      Alert.alert('Error', 'Could not create a share link. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  const handleEndEarly = () => {
    setShowOptions(false);
    Alert.alert(
      'End journey?',
      `${guardians} will be told you've stopped sharing, without an arrival.`,
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'End journey',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelJourney();
              router.replace('/(app)/home');
            } catch {
              Alert.alert('Error', 'Could not end the journey. Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <AppMapView
        region={mapData.region}
        markers={mapData.markers}
        polyline={mapData.polyline}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Floating header — back out to Home without stopping the journey, and
          the guardian status that answers "is anyone actually seeing this?" */}
      <View style={[styles.header, { top: insets.top + SPACING.sm }]} pointerEvents="box-none">
        <TouchableOpacity
          onPress={goHome}
          style={styles.backChip}
          accessibilityRole="button"
          accessibilityLabel="Back to home. Your journey keeps running."
        >
          <Icon name="chevronLeft" size={22} color={theme.textPrimary} />
        </TouchableOpacity>

        <GlassPill style={styles.sharingPill}>
          <View
            style={[
              styles.sharingDot,
              { backgroundColor: freshness.stale ? theme.warning.fg : theme.accent },
            ]}
          />
          <Text style={styles.sharingPillText} numberOfLines={1}>
            {members.length > 0 ? `${guardians} can see you` : 'No guardians yet'}
          </Text>
        </GlassPill>
      </View>

      {/* §D: the turn banner sits below the header, over the map. */}
      <View style={[styles.bannerSlot, { top: insets.top + 64 }]} pointerEvents="box-none">
        <TurnBanner streetName={legName} remainingDistance={remainingDistance} />
        <LowBatteryBanner />
        {backgroundPermissionRevoked && (
          <TouchableOpacity
            style={styles.warningBanner}
            onPress={dismissPermissionWarning}
            accessibilityRole="button"
            accessibilityLabel="Background location is off. Tap to dismiss."
          >
            <Icon name="warning" size={16} color={theme.warning.fg} />
            <Text style={styles.warningBannerText} numberOfLines={2}>
              Background location is off — {guardians} won't see updates while wayLoc is closed.
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/*
        §D's bottom stack, in its specified order: ETA capsule, then the uneasy
        pill, then the safety dock. The dock is the same component Home renders,
        in the same place on screen — §1 principle 3, so the control you need
        when something is wrong is never somewhere new.
      */}
      <View style={[styles.stack, { paddingBottom: insets.bottom + SPACING.md }]}>
        <EtaCapsule
          minutesLabel={minutesRemaining !== null ? `${minutesRemaining} min` : null}
          detail={etaDetail}
          guardianInitial={firstGuardian?.displayName?.[0]?.toUpperCase() ?? null}
          guardianId={firstGuardian?.id ?? null}
          checkInProgress={checkInProgress}
          checkInUrgent={checkInUrgent}
          onEnd={handleEndJourney}
          endBusy={ending}
        />

        <UneasyPill onPress={() => router.push('/(app)/uneasy')} />

        <SafetyDock
          checkInLabel="I'm OK"
          onCheckIn={handleImOk}
          onFakeCall={() => router.push('/(app)/fake-incoming-call')}
        />

        <View style={styles.statusRow}>
          <Text style={styles.statusText}>{freshness.stale ? 'GPS weak' : 'GPS good'}</Text>
          <Text style={styles.statusDot}>·</Text>
          <TouchableOpacity
            onPress={() => setShowOptions(true)}
            accessibilityRole="button"
            accessibilityLabel="Journey options"
          >
            <Text style={styles.statusLink}>Options</Text>
          </TouchableOpacity>
        </View>
      </View>

      <BottomSheet visible={showOptions} onDismiss={() => setShowOptions(false)}>
        <View style={styles.optionsContent}>
          <Text style={styles.optionsTitle}>Journey options</Text>
          <Button
            label="Share a tracking link"
            icon="link"
            variant="secondary"
            onPress={handleShare}
            loading={sharing}
          />
          <Button
            label={`Add ${SAFETY_CHECK_EXTENSION_MINUTES} minutes`}
            icon="time"
            variant="secondary"
            onPress={() => {
              setShowOptions(false);
              void addTime();
            }}
          />
        </View>
      </BottomSheet>
    </View>
  );
}


function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    safe: { flex: 1, backgroundColor: theme.background },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.md,
      paddingHorizontal: SPACING.xl,
    },
    emptyTitle: {
      fontSize: 22,
      fontFamily: FONTS.headingXBold,
      color: theme.textPrimary,
    },
    emptyDesc: {
      fontSize: 16,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: SPACING.md,
    },
    header: {
      position: 'absolute',
      left: SPACING.lg,
      right: SPACING.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    backChip: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      ...ELEVATION.float,
    },
    sharingPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.pill,
      backgroundColor: theme.surface,
      ...ELEVATION.float,
    },
    sharingDot: { width: 8, height: 8, borderRadius: 4 },
    sharingPillText: {
      fontSize: 15,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
    bannerSlot: {
      position: 'absolute',
      left: SPACING.lg,
      right: SPACING.lg,
      gap: SPACING.sm,
    },
    warningBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      backgroundColor: theme.warning.bg,
    },
    warningBannerText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      fontFamily: FONTS.bodyMedium,
      color: theme.warning.fg,
    },
    stack: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      gap: SPACING.sm,
      paddingHorizontal: SPACING.lg,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      paddingTop: SPACING.sm,
    },
    statusText: {
      fontSize: 14,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    statusDot: {
      fontSize: 14,
      color: theme.textTertiary,
    },
    statusLink: {
      fontSize: 14,
      fontFamily: FONTS.bodySemibold,
      color: theme.accent,
    },
    optionsContent: {
      gap: SPACING.md,
      paddingBottom: SPACING.md,
    },
    optionsTitle: {
      fontSize: 22,
      fontFamily: FONTS.headingXBold,
      color: theme.textPrimary,
      marginBottom: SPACING.xs,
    },
  });
}
