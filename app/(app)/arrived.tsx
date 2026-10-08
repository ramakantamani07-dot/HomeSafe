import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { haptics } from '../../src/utils/haptics';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../src/config/theme';
import { usePlaces } from '../../src/hooks/usePlaces';
import { useJourney } from '../../src/hooks/useJourney';
import { useFamily } from '../../src/hooks/useFamily';
import { useJourneyDraft } from '../../src/context/JourneyDraftContext';
import { Button } from '../../src/components/ui/Button';
import { Icon } from '../../src/components/ui/Icon';
import { joinGuardianNames } from '../../src/utils/guardians';
import {
  WALK_FEEDBACK_CAPTION,
  WALK_RATINGS,
  type WalkRating,
} from '../../src/models/WalkFeedback';
import { useAndroidBack } from '../../src/hooks/useAndroidBack';
import { DEFAULT_ARRIVAL_RADIUS_METERS } from '../../src/models/Place';

// Reuses the welcome illustration's hills — the same visual language as the
// design's arrival artwork, without shipping a second near-identical asset.
const arrivalIllustration = require('../../assets/home/home_soft_header_pattern.png');

function formatClockTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatMinutes(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function formatDistanceKm(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Screen 10 — "You've arrived".
 *
 * Reached after the journey has already ended, so it reads its summary from
 * navigation params rather than the (now cleared) active journey. Confirms
 * the two things the traveller most wants to know — guardians were told, and
 * sharing has stopped — before anything else on the screen.
 */
export default function ArrivedScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();

  const params = useLocalSearchParams<{
    name?: string;
    address?: string;
    arrivedAt?: string;
    durationMinutes?: string;
    distanceMeters?: string;
    alerts?: string;
    lat?: string;
    lng?: string;
    postcode?: string;
    placeId?: string;
    alreadySaved?: string;
    journeyId?: string;
    endedEarly?: string;
  }>();

  const { savePlace } = usePlaces();
  const { saveWalkFeedback } = useJourney();
  const { members } = useFamily();
  const { reset } = useJourneyDraft();

  const [saved, setSaved] = useState(params.alreadySaved === 'true');
  const [savingPlace, setSavingPlace] = useState(false);
  const [rating, setRating] = useState<WalkRating | null>(null);

  const guardians = useMemo(() => joinGuardianNames(members), [members]);

  const destinationName = params.name ?? 'your destination';
  const arrivedAt = params.arrivedAt ? new Date(Number(params.arrivedAt)) : new Date();
  const durationMinutes = params.durationMinutes ? Number(params.durationMinutes) : null;
  const distanceMeters = params.distanceMeters ? Number(params.distanceMeters) : null;
  const alerts = params.alerts ? Number(params.alerts) : 0;
  /**
   * The journey was stopped by the traveller rather than reaching its
   * destination (`AI4`'s End button). The summary is still worth showing —
   * and the walk feedback still worth asking for — but telling someone
   * they arrived somewhere they chose not to reach would be a plain lie,
   * and §1 principle 4 rules that out.
   */
  const endedEarly = params.endedEarly === 'true';

  // Arriving is the one unambiguously good outcome in this app, and worth
  // feeling. Suppressed when the journey was ended early: nothing was
  // achieved, and congratulating someone for stopping would read as mockery.
  useEffect(() => {
    if (!endedEarly) haptics.arrived();
  }, [endedEarly]);

  const latitude = params.lat ? Number(params.lat) : null;
  const longitude = params.lng ? Number(params.lng) : null;
  const canSave = !saved && latitude !== null && longitude !== null && !Number.isNaN(latitude);

  const handleSavePlace = async () => {
    if (latitude === null || longitude === null) return;
    setSavingPlace(true);
    try {
      await savePlace(
        destinationName,
        {
          name: destinationName,
          formattedAddress: params.address ?? '',
          postcode: params.postcode ?? null,
          coordinates: { latitude, longitude },
          placeId: params.placeId ?? null,
        },
        'custom',
        DEFAULT_ARRIVAL_RADIUS_METERS,
      );
      setSaved(true);
    } catch {
      // Saving a shortcut is a convenience — failing it shouldn't turn an
      // arrival confirmation into an error screen.
    } finally {
      setSavingPlace(false);
    }
  };

  /**
   * Optional and fire-and-forget. Arrival is a moment of relief, not a survey:
   * a failed write must never produce an error on this screen, and Done works
   * whether or not anything was chosen.
   */
  const handleRate = useCallback(
    (next: WalkRating) => {
      setRating(next);
      const journeyId = params.journeyId;
      if (journeyId) void saveWalkFeedback(journeyId, next).catch(() => {});
    },
    [params.journeyId, saveWalkFeedback],
  );

  const handleDone = useCallback(() => {
    reset();
    router.replace('/(app)/home');
  }, [reset, router]);

  // The journey is already over — "Done" is the only way out, and Android
  // back must mean the same thing rather than reopening the picker the
  // journey started from.
  useAndroidBack(handleDone);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={arrivalIllustration} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroBadge}>
            <Icon name="check" size={28} color={theme.textOnColor} />
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{endedEarly ? 'Journey ended' : "You've arrived"}</Text>
          <Text style={styles.subtitle}>
            {destinationName} · {formatClockTime(arrivedAt)}
          </Text>

          <View style={styles.confirmCard}>
            <Icon name="check" size={20} color={theme.accent} />
            <Text style={styles.confirmText}>
              <Text style={styles.confirmStrong}>
                {members.length > 0 ? `${guardians} have been told.` : 'Journey complete.'}
              </Text>{' '}
              Sharing has stopped.
            </Text>
          </View>

          <View style={styles.statsCard}>
            <Stat
              styles={styles}
              value={durationMinutes !== null ? formatMinutes(durationMinutes) : '—'}
              label="Journey time"
            />
            <Stat
              styles={styles}
              value={distanceMeters !== null ? formatDistanceKm(distanceMeters) : '—'}
              label="Travelled"
            />
            <Stat styles={styles} value={String(alerts)} label={alerts === 1 ? 'Alert' : 'Alerts'} />
          </View>

          {/*
            Asked once, answered privately. The caption carries both halves of
            the promise — that guardians never see it, and what it is actually
            for — because an unexplained question at the end of a journey reads
            as surveillance.
          */}
          {params.journeyId && (
            <View style={styles.feedbackCard}>
              <Text style={styles.feedbackTitle}>How did the walk feel?</Text>
              <View style={styles.feedbackRow}>
                {WALK_RATINGS.map(({ rating: value, label }) => {
                  const selected = rating === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      style={[styles.feedbackChip, selected && styles.feedbackChipSelected]}
                      onPress={() => handleRate(value)}
                      activeOpacity={0.8}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`The walk felt ${label.toLowerCase()}`}
                    >
                      <Text
                        style={[
                          styles.feedbackChipText,
                          selected && styles.feedbackChipTextSelected,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.feedbackCaption}>{WALK_FEEDBACK_CAPTION}</Text>
            </View>
          )}

          {canSave && (
            <View style={styles.saveCard}>
              <Icon name="star" size={22} color={theme.textPrimary} />
              <View style={styles.saveText}>
                <Text style={styles.saveTitle}>Save this place?</Text>
                <Text style={styles.saveSubtitle}>One tap next time</Text>
              </View>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSavePlace}
                disabled={savingPlace}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Save ${destinationName} as a place`}
              >
                <Text style={styles.saveButtonText}>{savingPlace ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {saved && params.alreadySaved !== 'true' && (
            <View style={styles.savedConfirm}>
              <Icon name="checkCircle" size={18} color={theme.accent} />
              <Text style={styles.savedConfirmText}>Saved to your places.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Done" variant="strong" onPress={handleDone} />
      </View>
    </SafeAreaView>
  );
}

function Stat({
  styles,
  value,
  label,
}: {
  styles: ReturnType<typeof getStyles>;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    container: { paddingBottom: SPACING.xl },
    hero: {
      height: 240,
      backgroundColor: theme.accentMuted,
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    heroImage: {
      ...StyleSheet.absoluteFillObject,
      width: undefined,
      height: undefined,
    },
    heroBadge: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
      marginBottom: -32,
      borderWidth: 4,
      borderColor: theme.background,
    },
    body: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.xxl + SPACING.md,
      gap: SPACING.md,
    },
    title: {
      fontSize: 34,
      lineHeight: 40,
      fontFamily: FONTS.headingXBold,
      color: theme.textPrimary,
      letterSpacing: -0.6,
    },
    subtitle: {
      fontSize: 17,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    confirmCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.md,
      padding: SPACING.lg,
      borderRadius: RADIUS.lg,
      backgroundColor: theme.accentMuted,
      marginTop: SPACING.sm,
    },
    confirmText: {
      flex: 1,
      fontSize: 16,
      lineHeight: 23,
      fontFamily: FONTS.body,
      color: theme.textPrimary,
    },
    confirmStrong: {
      fontFamily: FONTS.bodySemibold,
    },
    statsCard: {
      flexDirection: 'row',
      padding: SPACING.lg,
      borderRadius: RADIUS.lg,
      backgroundColor: theme.surface,
      gap: SPACING.lg,
    },
    stat: { flex: 1, gap: 2 },
    statValue: {
      fontSize: 22,
      fontFamily: FONTS.headingXBold,
      color: theme.textPrimary,
    },
    statLabel: {
      fontSize: 14,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    feedbackCard: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      gap: SPACING.md,
    },
    feedbackTitle: {
      fontSize: 17,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
    feedbackRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    feedbackChip: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: RADIUS.pill,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.background,
    },
    feedbackChipSelected: {
      borderColor: theme.accent,
      backgroundColor: theme.accentMuted,
    },
    feedbackChipText: {
      fontSize: 15,
      fontFamily: FONTS.bodySemibold,
      color: theme.textSecondary,
    },
    feedbackChipTextSelected: { color: theme.accent },
    feedbackCaption: {
      fontSize: 13,
      lineHeight: 18,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    saveCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      padding: SPACING.lg,
      borderRadius: RADIUS.lg,
      backgroundColor: theme.surface,
    },
    saveText: { flex: 1, gap: 2 },
    saveTitle: {
      fontSize: 17,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
    saveSubtitle: {
      fontSize: 15,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    saveButton: {
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.pill,
      borderWidth: 1.5,
      borderColor: theme.accent,
    },
    saveButtonText: {
      fontSize: 16,
      fontFamily: FONTS.bodySemibold,
      color: theme.accent,
    },
    savedConfirm: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingVertical: SPACING.sm,
    },
    savedConfirmText: {
      fontSize: 15,
      fontFamily: FONTS.body,
      color: theme.accent,
    },
    footer: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.md,
    },
  });
}
