import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../src/config/theme';
import { useJourney } from '../../src/hooks/useJourney';
import { useJourneyDraft } from '../../src/context/JourneyDraftContext';
import { Icon, type IconName } from '../../src/components/ui/Icon';
import { Button } from '../../src/components/ui/Button';
import type { Journey, JourneyStatus } from '../../src/models/Journey';

const STATUS_VISUAL: Record<
  JourneyStatus,
  { label: string; icon: IconName; tone: 'safe' | 'warning' | 'critical' | 'neutral' }
> = {
  ACTIVE: { label: 'In progress', icon: 'navigate', tone: 'safe' },
  COMPLETED: { label: 'Arrived', icon: 'checkCircle', tone: 'safe' },
  CANCELLED: { label: 'Ended early', icon: 'close', tone: 'neutral' },
  MISSED_CHECKIN: { label: 'Missed check-in', icon: 'warning', tone: 'warning' },
  SOS_TRIGGERED: { label: 'SOS', icon: 'sos', tone: 'critical' },
};

function formatDate(date: Date): string {
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today ${time}`;
  if (isYesterday) return `Yesterday ${time}`;
  return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${time}`;
}

function formatDuration(journey: Journey): string | null {
  if (!journey.endedAt) return null;
  const minutes = Math.max(1, Math.round((journey.endedAt.getTime() - journey.startedAt.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function formatDistance(meters: number | null): string | null {
  if (meters === null) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * The Journeys tab — past journeys, newest first.
 *
 * Refetches on focus rather than holding a cached list in context: a journey
 * ending is exactly when this list changes, and that happens on a different
 * screen. Anything cached would be stale precisely when the user comes here
 * to look at it.
 */
export default function JourneysScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();

  const { activeJourney, listHistory } = useJourney();
  const { reset } = useJourneyDraft();

  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `listHistory` is a stable callback from JourneyContext — it only changes
  // when the signed-in user does, so this focus effect refetches on focus and
  // on sign-in, and at no other time.
  const load = useCallback(async () => {
    setError(null);
    try {
      setJourneys(await listHistory());
    } catch {
      setError("Couldn't load your journeys. Pull down to try again.");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [listHistory]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={theme.textSecondary}
          />
        }
      >
        <Text style={styles.title}>Journeys</Text>

        {activeJourney && (
          <TouchableOpacity
            style={styles.activeCard}
            onPress={() => router.push('/(app)/active-journey')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="View the journey in progress"
          >
            <View style={styles.activePill}>
              <View style={styles.activeDot} />
              <Text style={styles.activePillText}>In progress</Text>
            </View>
            <Text style={styles.activeTitle} numberOfLines={1}>
              {activeJourney.destination?.name ?? activeJourney.destinationLabel}
            </Text>
            <Text style={styles.activeSubtitle}>
              Started {formatDate(activeJourney.startedAt)}
            </Text>
          </TouchableOpacity>
        )}

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : journeys.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="compass" size={48} color={theme.textTertiary} />
            <Text style={styles.emptyTitle}>No journeys yet</Text>
            <Text style={styles.emptyText}>
              When you share a journey, it'll show up here with how long it took and whether
              anything went wrong.
            </Text>
            <Button
              label="Start a journey"
              variant="strong"
              fullWidth={false}
              onPress={() => {
                reset();
                router.push('/(app)/where-to');
              }}
            />
          </View>
        ) : (
          <View style={styles.list}>
            {journeys.map((journey, index) => {
              const visual = STATUS_VISUAL[journey.status];
              const tone =
                visual.tone === 'safe'
                  ? { fg: theme.accent, bg: theme.accentMuted }
                  : visual.tone === 'warning'
                    ? { fg: theme.warning.fg, bg: theme.warning.bg }
                    : visual.tone === 'critical'
                      ? { fg: theme.critical.fg, bg: theme.critical.bg }
                      : { fg: theme.textSecondary, bg: theme.border };

              const meta = [formatDuration(journey), formatDistance(journey.routeDistanceMeters)]
                .filter(Boolean)
                .join(' · ');

              return (
                <View
                  key={journey.id}
                  style={[styles.row, index < journeys.length - 1 && styles.rowDivider]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: tone.bg }]}>
                    <Icon name={visual.icon} size={20} color={tone.fg} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {journey.destination?.name ?? journey.destinationLabel}
                    </Text>
                    <Text style={styles.rowSubtitle} numberOfLines={1}>
                      {formatDate(journey.startedAt)}
                      {meta ? ` · ${meta}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.rowStatus, { color: tone.fg }]}>{visual.label}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    container: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.xxxl,
      gap: SPACING.lg,
    },
    title: {
      fontSize: 34,
      fontFamily: FONTS.headingXBold,
      color: theme.textPrimary,
      letterSpacing: -0.6,
    },
    centered: { paddingVertical: SPACING.xxxl, alignItems: 'center' },
    activeCard: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.xl,
      borderWidth: 2,
      borderColor: theme.accent,
      padding: SPACING.lg,
      gap: SPACING.xs,
    },
    activePill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.md,
      paddingVertical: 5,
      borderRadius: RADIUS.pill,
      backgroundColor: theme.accentMuted,
      marginBottom: SPACING.xs,
    },
    activeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.accent,
    },
    activePillText: {
      fontSize: 13,
      fontFamily: FONTS.bodySemibold,
      color: theme.accent,
    },
    activeTitle: {
      fontSize: 22,
      fontFamily: FONTS.headingXBold,
      color: theme.textPrimary,
    },
    activeSubtitle: {
      fontSize: 15,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    list: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.lg,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    rowIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowText: { flex: 1, gap: 2 },
    rowTitle: {
      fontSize: 17,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
    rowSubtitle: {
      fontSize: 15,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    rowStatus: {
      fontSize: 14,
      fontFamily: FONTS.bodySemibold,
      maxWidth: 96,
      textAlign: 'right',
    },
    empty: {
      alignItems: 'center',
      gap: SPACING.md,
      paddingVertical: SPACING.xxxl,
      paddingHorizontal: SPACING.lg,
    },
    emptyTitle: {
      fontSize: 22,
      fontFamily: FONTS.headingXBold,
      color: theme.textPrimary,
    },
    emptyText: {
      fontSize: 16,
      lineHeight: 23,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: SPACING.sm,
    },
    errorText: {
      fontSize: 15,
      fontFamily: FONTS.body,
      color: theme.critical.fg,
      textAlign: 'center',
      paddingVertical: SPACING.xl,
    },
  });
}
