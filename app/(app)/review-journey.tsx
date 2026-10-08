import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { ELEVATION, FONTS, RADIUS, SPACING, identityColor, type ThemeColors } from '../../src/config/theme';
import { useJourneyDraft } from '../../src/context/JourneyDraftContext';
import { useJourney } from '../../src/hooks/useJourney';
import { usePlaces } from '../../src/hooks/usePlaces';
import { usePrivacy } from '../../src/hooks/usePrivacy';
import { useFamily } from '../../src/hooks/useFamily';
import { useCurrentPosition } from '../../src/hooks/useCurrentPosition';
import { useRoutePreview } from '../../src/hooks/useRoutePreview';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Button } from '../../src/components/ui/Button';
import { Icon, type IconName } from '../../src/components/ui/Icon';
import { AppMapView } from '../../src/components/map/AppMapView';
import { joinGuardianNames } from '../../src/utils/guardians';
import { TRAVEL_MODES, type TravelMode } from '../../src/models/Place';

const MODE_ICON: Record<TravelMode, IconName> = {
  walk: 'walk',
  bus: 'bus',
  bike: 'bike',
  car: 'car',
};

const MODE_ROUTE_LABEL: Record<TravelMode, string> = {
  walk: 'Fastest walking route',
  bus: 'Fastest bus route',
  bike: 'Fastest cycling route',
  car: 'Fastest driving route',
};

/**
 * Screen 04 — "Review & start".
 *
 * The last screen before location starts being shared, so everything the
 * guardians will see is stated here: the route, who it goes to, and exactly
 * what happens if something looks wrong. Start routes to 05 when location
 * permission hasn't been granted yet, otherwise straight to 06.
 */
export default function ReviewJourneyScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();

  const { draft, setTravelMode, setSaveAsPlace, reset } = useJourneyDraft();
  const { startJourney, journeyPreferences } = useJourney();

  // Shown, not edited — the rules this journey will inherit from Settings.
  const alertRules = journeyPreferences.alertRules;
  const { isAlreadySaved, savePlace } = usePlaces();
  const { locationStatus, locationBackgroundStatus } = usePrivacy();
  const { members } = useFamily();
  const { position } = useCurrentPosition();

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destination = draft.destination;
  const preview = useRoutePreview(position, destination?.coordinates ?? null, draft.travelMode);

  const guardians = useMemo(() => joinGuardianNames(members), [members]);
  const alreadySaved = destination ? isAlreadySaved(destination) : false;

  // A destination can go missing if the screen is reached directly (deep
  // link, or state cleared while backgrounded) — send the user back to pick
  // one rather than rendering an empty review.
  if (!destination) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Review & start" onBack={() => router.back()} titleLines={1} />
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Choose where you're going first.</Text>
          <Button
            label="Pick a destination"
            variant="strong"
            onPress={() => router.replace('/(app)/where-to')}
          />
        </View>
      </SafeAreaView>
    );
  }

  const handleStart = async () => {
    setError(null);

    // Screen 05 explains why location is needed *before* the OS dialog fires.
    // Spec: shown on the first journey, or whenever permission is missing.
    const needsPermissionPrimer =
      locationStatus !== 'granted' || locationBackgroundStatus === 'undetermined';

    if (needsPermissionPrimer) {
      router.push('/(app)/allow-location');
      return;
    }

    setStarting(true);
    try {
      if (draft.saveAsPlace && !alreadySaved) {
        // Best-effort: failing to save a shortcut must never block the
        // journey the user actually asked for.
        await savePlace(
          destination.name,
          destination,
          'custom',
          draft.arrivalRadiusMeters,
        ).catch(() => {});
      }

      await startJourney({
        destination,
        savedPlaceId: draft.savedPlaceId,
        travelMode: draft.travelMode,
        alertRules: alertRules,
        arrivalRadiusMeters: draft.arrivalRadiusMeters,
      });

      reset();
      router.replace('/(app)/active-journey');
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Could not start the journey. Please try again.',
      );
    } finally {
      setStarting(false);
    }
  };

  const routeSummary = preview.formattedDistance
    ? `${preview.formattedDistance} to ${destination.name}`
    : null;

  const startSubtitle = preview.formattedEta
    ? `Arrive about ${preview.formattedEta} · sharing stops when you arrive`
    : 'Sharing stops when you arrive';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title={destination.name}
        subtitle={destination.postcode
          ? `${shortAddress(destination.formattedAddress)}, ${destination.postcode}`
          : destination.formattedAddress}
        subtitleAction={{ label: 'Change', onPress: () => router.replace('/(app)/where-to') }}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Route preview */}
        <View style={styles.card}>
          <View style={styles.mapPreview}>
            <AppMapView
              region={mapRegionFor(position, destination.coordinates)}
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
            {preview.isLoading && (
              <View style={styles.mapLoading}>
                <ActivityIndicator color={theme.accent} />
              </View>
            )}
          </View>

          <View style={styles.routeFooter}>
            <View style={styles.routeText}>
              <Text style={styles.routeTitle} numberOfLines={1}>
                {routeSummary ?? 'Route unavailable'}
              </Text>
              <Text style={styles.routeSubtitle} numberOfLines={1}>
                {preview.formattedDuration
                  ? `${MODE_ROUTE_LABEL[draft.travelMode]} · ${preview.formattedDuration}`
                  : "We'll still follow your location"}
              </Text>
            </View>
          </View>
        </View>

        {preview.error && <Text style={styles.noticeText}>{preview.error}</Text>}

        {/* Travel mode */}
        <View style={styles.segmented}>
          {TRAVEL_MODES.map(({ mode, label }) => {
            const selected = draft.travelMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                style={[styles.segment, selected && styles.segmentSelected]}
                onPress={() => setTravelMode(mode)}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Travelling by ${label.toLowerCase()}`}
              >
                <Icon
                  name={MODE_ICON[mode]}
                  size={16}
                  color={selected ? theme.textPrimary : theme.textSecondary}
                />
                <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* "Save as a place" — only meaningful for a destination not already saved */}
        {!alreadySaved && (
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <Icon name="star" size={22} color={theme.textPrimary} />
              <View style={styles.switchText}>
                <Text style={styles.switchTitle}>Save as a place</Text>
                <Text style={styles.switchSubtitle}>One tap next time</Text>
              </View>
              <Switch
                value={draft.saveAsPlace}
                onValueChange={setSaveAsPlace}
                trackColor={{ false: theme.border, true: theme.accent }}
                thumbColor={theme.surface}
                accessibilityLabel="Save this destination as a place"
              />
            </View>
          </View>
        )}

        {/* Sharing + alert rules */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.sharingRow}
            onPress={() => router.push('/(app)/family')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Sharing with ${guardians}. Change who can see this journey.`}
          >
            <Text style={styles.sharingLabel}>Sharing with</Text>
            <View style={styles.avatarStack}>
              {members.slice(0, 3).map((m, index) => (
                <View
                  key={m.id}
                  style={[
                    styles.avatar,
                    { backgroundColor: identityColor(theme, m.id), marginLeft: index === 0 ? 0 : -12 },
                  ]}
                >
                  <Text style={styles.avatarText}>
                    {m.displayName?.[0]?.toUpperCase() ?? '?'}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.sharingNames} numberOfLines={1}>{guardians}</Text>
            <Icon name="chevronRight" size={18} color={theme.textSecondary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <View style={styles.rulesHeader}>
            <Text style={styles.rulesTitle}>If something seems off</Text>
            {/* No "Edit" here by design. §10's acceptance criterion: "All
                setup lives in Settings; nothing on the journey screens asks the
                user to configure anything." This row tells you what will happen;
                changing it is a Settings decision, not one to make while trying
                to leave. */}
          </View>

          <RuleRow
            styles={styles}
            condition={`${alertRules.lateMinutes} min late, or stopped ${alertRules.stoppedMinutes} min`}
            outcome="Ask if I'm OK"
          />
          <RuleRow
            styles={styles}
            condition={`No reply in ${alertRules.noReplyMinutes} min`}
            outcome={`Alert ${guardians}`}
          />
          <RuleRow
            styles={styles}
            condition={`Battery under ${alertRules.lowBatteryPercent}%`}
            outcome="Send last location"
          />
        </View>

        {members.length === 0 && (
          <Text style={styles.noticeText}>
            You haven't added anyone to your family yet — no one will be alerted. Add a guardian
            from the Family tab first.
          </Text>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.startButton, starting && styles.startButtonBusy]}
          onPress={handleStart}
          disabled={starting}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Start journey to ${destination.name}. ${startSubtitle}`}
        >
          {starting ? (
            <ActivityIndicator color={theme.strongText} />
          ) : (
            <>
              <Text style={styles.startButtonLabel}>Start journey</Text>
              <Text style={styles.startButtonSubtitle}>{startSubtitle}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

function RuleRow({
  styles,
  condition,
  outcome,
}: {
  styles: ReturnType<typeof getStyles>;
  condition: string;
  outcome: string;
}) {
  return (
    <View style={styles.ruleRow}>
      <Text style={styles.ruleCondition} numberOfLines={2}>{condition}</Text>
      <Text style={styles.ruleOutcome} numberOfLines={2}>{outcome}</Text>
    </View>
  );
}

/** Drops the postcode tail so the header subtitle doesn't repeat it. */
function shortAddress(formatted: string): string {
  return formatted.split(',').slice(0, 2).join(',').trim();
}

/** A region containing both the user and the destination, with padding. */
function mapRegionFor(
  from: { latitude: number; longitude: number } | null,
  to: { latitude: number; longitude: number },
) {
  if (!from) {
    return { ...to, latitudeDelta: 0.01, longitudeDelta: 0.01 };
  }
  const latitude = (from.latitude + to.latitude) / 2;
  const longitude = (from.longitude + to.longitude) / 2;
  return {
    latitude,
    longitude,
    latitudeDelta: Math.max(Math.abs(from.latitude - to.latitude) * 1.8, 0.006),
    longitudeDelta: Math.max(Math.abs(from.longitude - to.longitude) * 1.8, 0.006),
  };
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    container: {
      paddingHorizontal: SPACING.xl,
      paddingBottom: SPACING.xl,
      gap: SPACING.lg,
    },
    emptyState: {
      flex: 1,
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
    card: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.xl,
      overflow: 'hidden',
    },
    mapPreview: {
      height: 220,
      backgroundColor: theme.border,
    },
    mapLoading: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    routeFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.md,
      padding: SPACING.lg,
    },
    routeText: { flex: 1, gap: 2 },
    routeTitle: {
      fontSize: 18,
      fontFamily: FONTS.heading,
      color: theme.textPrimary,
    },
    routeSubtitle: {
      fontSize: 15,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    segmented: {
      flexDirection: 'row',
      padding: 5,
      borderRadius: RADIUS.lg,
      backgroundColor: theme.border,
      gap: 4,
    },
    segment: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.md,
    },
    segmentSelected: {
      backgroundColor: theme.surface,
      ...ELEVATION.sm,
    },
    segmentText: {
      fontSize: 15,
      fontFamily: FONTS.bodyMedium,
      color: theme.textSecondary,
    },
    segmentTextSelected: {
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      padding: SPACING.lg,
    },
    switchText: { flex: 1, gap: 2 },
    switchTitle: {
      fontSize: 17,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
    switchSubtitle: {
      fontSize: 15,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    sharingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      padding: SPACING.lg,
    },
    sharingLabel: {
      fontSize: 17,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
    avatarStack: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.surface,
    },
    avatarText: {
      color: theme.textOnColor,
      fontSize: 14,
      fontFamily: FONTS.heading,
    },
    sharingNames: {
      flex: 1,
      fontSize: 17,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
      textAlign: 'right',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
      marginHorizontal: SPACING.lg,
    },
    rulesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.sm,
    },
    rulesTitle: {
      fontSize: 17,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
    linkText: {
      fontSize: 16,
      fontFamily: FONTS.bodySemibold,
      color: theme.accent,
    },
    ruleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: SPACING.lg,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
    },
    ruleCondition: {
      flex: 1,
      fontSize: 15,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
      lineHeight: 21,
    },
    ruleOutcome: {
      flexShrink: 0,
      maxWidth: '50%',
      fontSize: 15,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
      textAlign: 'right',
      lineHeight: 21,
    },
    noticeText: {
      fontSize: 14,
      fontFamily: FONTS.body,
      color: theme.warning.fg,
      lineHeight: 20,
    },
    errorText: {
      fontSize: 14,
      fontFamily: FONTS.body,
      color: theme.critical.fg,
      lineHeight: 20,
    },
    footer: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.lg,
      backgroundColor: theme.background,
    },
    startButton: {
      minHeight: 72,
      borderRadius: RADIUS.pill,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
      backgroundColor: theme.strong,
    },
    startButtonBusy: { opacity: 0.8 },
    startButtonLabel: {
      fontSize: 19,
      fontFamily: FONTS.heading,
      color: theme.strongText,
    },
    startButtonSubtitle: {
      fontSize: 14,
      fontFamily: FONTS.body,
      color: theme.strongText,
      opacity: 0.8,
      textAlign: 'center',
    },
  });
}
