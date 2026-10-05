import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
import { Icon } from '../ui/Icon';
import { formatDistance, type PlaceSuggestion } from '../../models/Place';

interface SearchResultsProps {
  results: PlaceSuggestion[];
  isSearching: boolean;
  error: string | null;
  isEmpty: boolean;
  query: string;
  /** Real routed duration for the top result only — see the note on estimates. */
  topDuration: string | null;
  /** "arrive 21:44" for the top result, null until the route resolves. */
  topArrival: string | null;
  guardians: string;
  /** Starts immediately with defaults, skipping review (spec §3B "Go"). */
  onGo(suggestion: PlaceSuggestion): void;
  /** Opens the route screen to review before starting (spec §3B "Directions"). */
  onDirections(suggestion: PlaceSuggestion): void;
  /** Set while a selection is resolving to full coordinates. */
  busyPlaceId: string | null;
}

/**
 * Search results inside Home's sheet (Option 15 `AI2`).
 *
 * The first result is a card with both actions; the rest are compact rows with
 * a "Go" pill. That asymmetry is the design's, and it matches intent — people
 * searching a postcode almost always want the first hit, so the primary action
 * is one tap from the keyboard.
 */
export function SearchResults({
  results,
  isSearching,
  error,
  isEmpty,
  query,
  topDuration,
  topArrival,
  guardians,
  onGo,
  onDirections,
  busyPlaceId,
}: SearchResultsProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  if (error) {
    return <Text style={styles.message}>{error}</Text>;
  }

  if (isEmpty) {
    return (
      <Text style={styles.message}>
        Nothing matched "{query.trim()}". Try a postcode, or pick a spot on the map.
      </Text>
    );
  }

  if (results.length === 0) {
    return isSearching ? (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.textSecondary} />
      </View>
    ) : null;
  }

  const [top, ...rest] = results;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {/* Top result — both actions, and what the guardians will see. */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.pin}>
            <Icon name="location" size={18} color={theme.accent} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle} numberOfLines={1}>{top.primaryText}</Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {[formatDistance(top.distanceMeters), top.secondaryText]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.goButton}
            onPress={() => onGo(top)}
            disabled={busyPlaceId !== null}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={
              topDuration
                ? `Go to ${top.primaryText}, about ${topDuration}`
                : `Go to ${top.primaryText}`
            }
          >
            {busyPlaceId === top.placeId ? (
              <ActivityIndicator color={theme.strongText} size="small" />
            ) : (
              <Text style={styles.goLabel}>
                {topDuration ? `Go · ${topDuration}` : 'Go'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.directionsButton}
            onPress={() => onDirections(top)}
            disabled={busyPlaceId !== null}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Directions to ${top.primaryText}`}
          >
            <Text style={styles.directionsLabel}>Directions</Text>
          </TouchableOpacity>
        </View>

        {/*
          Stated before starting, not after: this is the moment someone decides
          whether to share, so who can see them and when they are expected
          belongs here rather than on a confirmation they have already passed.
        */}
        <Text style={styles.watchers} numberOfLines={1}>
          {guardians} will see you{topArrival ? ` · arrive ${topArrival}` : ''}
        </Text>
      </View>

      {rest.map((suggestion) => (
        <View key={suggestion.placeId} style={styles.row}>
          <View style={styles.rowPin}>
            <Icon name="location" size={16} color={theme.textSecondary} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.rowTitle} numberOfLines={1}>{suggestion.primaryText}</Text>
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              {[formatDistance(suggestion.distanceMeters), suggestion.secondaryText]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.rowGo}
            onPress={() => onGo(suggestion)}
            disabled={busyPlaceId !== null}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Go to ${suggestion.primaryText}`}
          >
            {busyPlaceId === suggestion.placeId ? (
              <ActivityIndicator color={theme.accent} size="small" />
            ) : (
              <Text style={styles.rowGoLabel}>Go</Text>
            )}
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.xxl,
      gap: SPACING.sm,
    },
    message: {
      fontSize: 15,
      lineHeight: 21,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.lg,
    },
    loading: { paddingVertical: SPACING.xl, alignItems: 'center' },
    card: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      gap: SPACING.md,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    pin: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentMuted,
    },
    cardText: { flex: 1, gap: 2 },
    cardTitle: {
      fontSize: 18,
      fontFamily: FONTS.heading,
      color: theme.textPrimary,
    },
    cardSubtitle: {
      fontSize: 14,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    cardActions: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    goButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: RADIUS.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.strong,
    },
    goLabel: {
      fontSize: 16,
      fontFamily: FONTS.bodySemibold,
      color: theme.strongText,
    },
    directionsButton: {
      minHeight: 48,
      paddingHorizontal: SPACING.xl,
      borderRadius: RADIUS.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentMuted,
    },
    directionsLabel: {
      fontSize: 16,
      fontFamily: FONTS.bodySemibold,
      color: theme.accent,
    },
    watchers: {
      fontSize: 13,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      minHeight: 64,
    },
    rowPin: { width: 24, alignItems: 'center' },
    rowTitle: {
      fontSize: 16,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
    rowSubtitle: {
      fontSize: 13,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    rowGo: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm + 2,
      borderRadius: RADIUS.pill,
      backgroundColor: theme.accentMuted,
      minHeight: 40,
      justifyContent: 'center',
    },
    rowGoLabel: {
      fontSize: 15,
      fontFamily: FONTS.bodySemibold,
      color: theme.accent,
    },
  });
}
