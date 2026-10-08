import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { FONTS, RADIUS, SPACING, identityColor, type ThemeColors } from '../../src/config/theme';
import { useJourneyDraft } from '../../src/context/JourneyDraftContext';
import { useJourney } from '../../src/hooks/useJourney';
import { useFamily } from '../../src/hooks/useFamily';
import { usePrivacy } from '../../src/hooks/usePrivacy';
import { useCurrentPosition } from '../../src/hooks/useCurrentPosition';
import { useRoutePreview } from '../../src/hooks/useRoutePreview';
import { AppMapView } from '../../src/components/map/AppMapView';
import { Button } from '../../src/components/ui/Button';
import { Icon } from '../../src/components/ui/Icon';
import { GlassPill, TimelineStep } from '../../src/components/glass';
import { buildJourneyTimeline } from '../../src/models/JourneyTimeline';
import { joinGuardianNames } from '../../src/utils/guardians';

/**
 * Screen `AI3` — Route, the journey timeline.
 *
 * Reached from "Directions" on a search result. The quick path ("Go") skips
 * this entirely and starts on saved defaults, so everything here is for the
 * traveller who wants to see the route before sharing their location.
 */
export default function RouteScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { draft, reset } = useJourneyDraft();
  const { startJourney, journeyPreferences } = useJourney();
  const { members } = useFamily();
  const { locationStatus } = usePrivacy();
  const { position } = useCurrentPosition();

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watchEnabled, setWatchEnabled] = useState(true);

  const destination = draft.destination;
  // The only screen that asks for steps — the live journey has no use for them.
  const preview = useRoutePreview(
    position,
    destination?.coordinates ?? null,
    draft.travelMode,
    true,
  );

  const guardians = useMemo(() => joinGuardianNames(members), [members]);
  const timeline = useMemo(
    () => buildJourneyTimeline(preview.route, destination?.name ?? 'your destination'),
    [preview.route, destination?.name],
  );

  const handleStart = useCallback(async () => {
    if (!destination) return;
    setError(null);

    // Screen 05 explains why location is needed before the OS dialog fires.
    if (locationStatus !== 'granted') {
      router.push('/(app)/allow-location');
      return;
    }

    setStarting(true);
    try {
      await startJourney({
        destination,
        savedPlaceId: draft.savedPlaceId,
        travelMode: draft.travelMode,
        alertRules: journeyPreferences.alertRules,
        arrivalRadiusMeters: draft.arrivalRadiusMeters,
        // The guardian toggle governs the periodic check-in only. Automatic
        // safety checks (late / stopped / off route) are always on and are not
        // the user's to disable — turning them off is how someone ends up
        // unmonitored while believing otherwise.
        checkInIntervalMinutes: watchEnabled
          ? journeyPreferences.checkInIntervalMinutes
          : null,
      });
      reset();
      router.replace('/(app)/active-journey');
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Could not start the journey. Please try again.',
      );
      setStarting(false);
    }
  }, [
    destination,
    locationStatus,
    router,
    startJourney,
    draft,
    watchEnabled,
    journeyPreferences,
    reset,
  ]);

  if (!destination) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={styles.emptyText}>Choose where you're going first.</Text>
        <Button
          label="Pick a destination"
          variant="strong"
          fullWidth={false}
          onPress={() => router.replace('/(app)/home')}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppMapView
        region={regionFor(position, destination.coordinates)}
        markers={[
          ...(position
            ? [{ id: 'start', coordinate: position, title: 'You', role: 'start' as const }]
            : []),
          {
            id: 'destination',
            coordinate: destination.coordinates,
            title: destination.name,
            role: 'destination' as const,
          },
        ]}
        polyline={preview.route ? { coordinates: preview.route.coordinates } : null}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={[styles.header, { top: insets.top + SPACING.sm }]} pointerEvents="box-none">
        <GlassPill onPress={() => router.back()} accessibilityLabel="Back">
          <Icon name="chevronLeft" size={22} color={theme.textPrimary} />
        </GlassPill>
        {preview.formattedDuration && (
          <GlassPill label={preview.formattedDuration} style={styles.durationPill} />
        )}
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.md }]}>
        <View style={styles.grabber} />

        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Text style={styles.eyebrow}>{modeVerb(draft.travelMode)} to</Text>
            <Text style={styles.title} numberOfLines={1}>{destination.name}</Text>
          </View>
          <View style={styles.titleMeta}>
            <Text style={styles.duration}>{preview.formattedDuration ?? '—'}</Text>
            {preview.formattedEta && (
              <Text style={styles.arrival}>arrive {preview.formattedEta}</Text>
            )}
          </View>
        </View>

        <ScrollView style={styles.timelineScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.timelineCard}>
            {preview.isLoading && !preview.route ? (
              <ActivityIndicator color={theme.accent} style={styles.timelineLoading} />
            ) : (
              timeline.map((entry, index) => (
                <TimelineStep
                  key={`${entry.kind}-${entry.title}-${index}`}
                  kind={entry.kind}
                  title={entry.title}
                  detail={entry.detail ?? undefined}
                  meta={entry.meta ?? undefined}
                  isLast={index === timeline.length - 1}
                />
              ))
            )}
          </View>

          {preview.error && <Text style={styles.notice}>{preview.error}</Text>}

          <View style={styles.watchRow}>
            <View style={styles.avatarStack}>
              {members.slice(0, 2).map((m, i) => (
                <View
                  key={m.id}
                  style={[
                    styles.avatar,
                    { backgroundColor: identityColor(theme, m.id), marginLeft: i === 0 ? 0 : -10 },
                  ]}
                >
                  <Text style={styles.avatarText}>
                    {m.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.watchText}>
              <Text style={styles.watchTitle} numberOfLines={1}>
                {members.length > 0 ? `${guardians} with you` : 'No guardians yet'}
              </Text>
              <Text style={styles.watchDetail} numberOfLines={2}>
                Check-in if you stop or run late
              </Text>
            </View>
            <Switch
              value={watchEnabled}
              onValueChange={setWatchEnabled}
              trackColor={{ false: theme.border, true: theme.accent }}
              thumbColor={theme.textOnColor}
              accessibilityLabel="Check in on me if I stop or run late"
            />
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}
        </ScrollView>

        <Button
          label={`Start ${modeVerb(draft.travelMode).toLowerCase()}`}
          variant="strong"
          onPress={handleStart}
          loading={starting}
          style={styles.startButton}
        />
      </View>
    </View>
  );
}

/** "Walk to" / "Ride to" / "Drive to" — the design's header verb. */
function modeVerb(mode: string): string {
  switch (mode) {
    case 'bike':
      return 'Ride';
    case 'car':
      return 'Drive';
    case 'bus':
      return 'Travel';
    default:
      return 'Walk';
  }
}

function regionFor(
  from: { latitude: number; longitude: number } | null,
  to: { latitude: number; longitude: number },
) {
  if (!from) return { ...to, latitudeDelta: 0.01, longitudeDelta: 0.01 };
  return {
    latitude: (from.latitude + to.latitude) / 2,
    longitude: (from.longitude + to.longitude) / 2,
    latitudeDelta: Math.max(Math.abs(from.latitude - to.latitude) * 2.2, 0.008),
    longitudeDelta: Math.max(Math.abs(from.longitude - to.longitude) * 2.2, 0.008),
  };
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.lg,
      paddingHorizontal: SPACING.xl,
    },
    emptyText: {
      fontSize: 16,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    header: {
      position: 'absolute',
      left: SPACING.lg,
      right: SPACING.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    durationPill: { paddingHorizontal: SPACING.lg },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '62%',
      paddingTop: SPACING.sm,
      paddingHorizontal: SPACING.lg,
      borderTopLeftRadius: RADIUS.sheet,
      borderTopRightRadius: RADIUS.sheet,
      backgroundColor: theme.surface,
      gap: SPACING.md,
    },
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.borderStrong,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: SPACING.md,
    },
    titleText: { flex: 1 },
    eyebrow: {
      fontSize: 14,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    title: {
      fontSize: 26,
      fontFamily: FONTS.headingXBold,
      color: theme.textPrimary,
      letterSpacing: -0.4,
    },
    titleMeta: { alignItems: 'flex-end' },
    duration: {
      fontSize: 26,
      fontFamily: FONTS.headingXBold,
      color: theme.textPrimary,
      letterSpacing: -0.4,
    },
    arrival: {
      fontSize: 13,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    timelineScroll: { flexGrow: 0 },
    timelineCard: {
      backgroundColor: theme.background,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      paddingBottom: SPACING.xs,
    },
    timelineLoading: { paddingVertical: SPACING.xl },
    notice: {
      fontSize: 13,
      fontFamily: FONTS.body,
      color: theme.warning.fg,
      paddingTop: SPACING.sm,
    },
    watchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginTop: SPACING.md,
      padding: SPACING.md,
      borderRadius: RADIUS.lg,
      backgroundColor: theme.background,
    },
    avatarStack: { flexDirection: 'row' },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.surface,
    },
    avatarText: {
      color: theme.textOnColor,
      fontSize: 13,
      fontFamily: FONTS.heading,
    },
    watchText: { flex: 1, gap: 2 },
    watchTitle: {
      fontSize: 15,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
    watchDetail: {
      fontSize: 13,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    errorText: {
      fontSize: 14,
      fontFamily: FONTS.body,
      color: theme.critical.fg,
      paddingTop: SPACING.sm,
    },
    startButton: { marginTop: SPACING.xs },
  });
}
