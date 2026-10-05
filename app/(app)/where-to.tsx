import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../src/config/theme';
import { useJourneyDraft } from '../../src/context/JourneyDraftContext';
import { usePlaces } from '../../src/hooks/usePlaces';
import { usePlaceSearch } from '../../src/hooks/usePlaceSearch';
import { useActiveJourneyLocation } from '../../src/hooks/useActiveJourneyLocation';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Icon, type IconName } from '../../src/components/ui/Icon';
import {
  formatDistance,
  type PlaceSuggestion,
  type SavedPlace,
  type SavedPlaceKind,
} from '../../src/models/Place';

const KIND_ICON: Record<SavedPlaceKind, IconName> = {
  home: 'home',
  work: 'briefcase',
  school: 'school',
  custom: 'location',
};

/**
 * Screen 02 — "Where to?"
 *
 * One search field covering place name, street address and postcode, with the
 * user's saved places listed above the results. Selecting a saved place that
 * has no address routes to screen 03 instead of starting a journey, which is
 * the branch the design's "School → + Add address" row exists for.
 */
export default function WhereToScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();

  const { savedPlaces, placesService } = usePlaces();
  const {
    setDestination,
    search: rememberedSearch,
    rememberSearch,
    setPendingAddressPlaceId,
    highlightedPlaceId,
    setHighlightedPlaceId,
  } = useJourneyDraft();
  const { currentLocation } = useActiveJourneyLocation();

  const { query, setQuery, results, isSearching, error, isEmpty, clear } =
    usePlaceSearch(currentLocation);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Restore the query the user had typed before they detoured to screen 03
  // ("02 keeps the typed query and results" — JOURNEY_FLOW_SPEC §3).
  useEffect(() => {
    if (rememberedSearch.query && !query) setQuery(rememberedSearch.query);
    // Runs once on mount; re-running on every keystroke would fight the field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (query) rememberSearch(query, results);
  }, [query, results, rememberSearch]);

  // The place just given an address glows briefly, then settles.
  useEffect(() => {
    if (!highlightedPlaceId) return;
    const id = setTimeout(() => setHighlightedPlaceId(null), 2_500);
    return () => clearTimeout(id);
  }, [highlightedPlaceId, setHighlightedPlaceId]);

  const handleSavedPlace = (saved: SavedPlace) => {
    if (!saved.place) {
      // No address yet → screen 03 fills it in, then returns here.
      setPendingAddressPlaceId(saved.id);
      router.push('/(app)/add-place');
      return;
    }
    setDestination(saved.place, {
      savedPlaceId: saved.id,
      origin: 'where-to',
      arrivalRadiusMeters: saved.arrivalRadiusMeters,
    });
    router.push('/(app)/review-journey');
  };

  const handleSuggestion = async (suggestion: PlaceSuggestion) => {
    setResolveError(null);
    setResolvingId(suggestion.placeId);
    try {
      const place = await placesService.resolve(suggestion);
      setDestination(place, { origin: 'where-to' });
      router.push('/(app)/review-journey');
    } catch {
      setResolveError("We couldn't get the details for that place. Try another result.");
    } finally {
      setResolvingId(null);
    }
  };

  const showResultsSection = query.trim().length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader title="Where to?" onBack={() => router.back()} titleLines={1} />

        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.fieldLabel}>Place name, address or postcode</Text>

          <View style={[styles.searchField, query.length > 0 && styles.searchFieldActive]}>
            <Icon name="search" size={20} color={theme.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search for a place"
              placeholderTextColor={theme.textTertiary}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search for a place, address or postcode"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={clear}
                style={styles.clearButton}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="close" size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.mapButton}
            onPress={() => router.push('/(app)/map-picker')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Choose a destination on the map instead"
          >
            <Icon name="map" size={20} color={theme.textPrimary} />
            <Text style={styles.mapButtonText}>Choose on map instead</Text>
          </TouchableOpacity>

          {savedPlaces.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>YOUR PLACES</Text>
              <View style={styles.list}>
                {savedPlaces.map((saved, index) => (
                  <TouchableOpacity
                    key={saved.id}
                    style={[
                      styles.row,
                      index < savedPlaces.length - 1 && styles.rowDivider,
                      highlightedPlaceId === saved.id && styles.rowHighlighted,
                    ]}
                    onPress={() => handleSavedPlace(saved)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={
                      saved.place
                        ? `${saved.name}, ${saved.place.formattedAddress}`
                        : `${saved.name}, no address yet. Add one.`
                    }
                  >
                    <View
                      style={[
                        styles.savedIcon,
                        { backgroundColor: saved.place ? theme.accentMuted : theme.border },
                      ]}
                    >
                      <Icon
                        name={KIND_ICON[saved.kind]}
                        size={18}
                        color={saved.place ? theme.accent : theme.textSecondary}
                      />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{saved.name}</Text>
                      {saved.place ? (
                        <Text style={styles.rowSubtitle} numberOfLines={1}>
                          {saved.place.formattedAddress}
                        </Text>
                      ) : (
                        <Text style={styles.addAddressText}>+ Add address</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {showResultsSection && (
            <>
              <View style={styles.resultsHeader}>
                <Text style={styles.sectionLabel}>RESULTS</Text>
                {isSearching && <ActivityIndicator size="small" color={theme.textSecondary} />}
              </View>

              {error && <Text style={styles.errorText}>{error}</Text>}
              {resolveError && <Text style={styles.errorText}>{resolveError}</Text>}

              {isEmpty && !error && (
                <Text style={styles.emptyText}>
                  No places matched "{query.trim()}". Try a postcode, or choose on the map.
                </Text>
              )}

              {results.length > 0 && (
                <View style={styles.list}>
                  {results.map((suggestion, index) => {
                    const distance = formatDistance(suggestion.distanceMeters);
                    return (
                      <TouchableOpacity
                        key={suggestion.placeId}
                        style={[styles.row, index < results.length - 1 && styles.rowDivider]}
                        onPress={() => handleSuggestion(suggestion)}
                        disabled={resolvingId !== null}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${suggestion.primaryText}, ${suggestion.secondaryText}`}
                      >
                        <View style={styles.pinIcon}>
                          {resolvingId === suggestion.placeId ? (
                            <ActivityIndicator size="small" color={theme.textSecondary} />
                          ) : (
                            <Icon name="location" size={20} color={theme.textPrimary} />
                          )}
                        </View>
                        <View style={styles.rowText}>
                          <Text style={styles.rowTitle} numberOfLines={1}>
                            {suggestion.primaryText}
                          </Text>
                          <Text style={styles.rowSubtitle} numberOfLines={1}>
                            {suggestion.secondaryText}
                            {distance ? ` · ${distance}` : ''}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}

          <Text style={styles.tip}>
            Tip: type a postcode like <Text style={styles.tipStrong}>SE15 4AB</Text> to pick the
            exact address.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    flex: { flex: 1 },
    container: {
      paddingHorizontal: SPACING.xl,
      paddingBottom: SPACING.xxxl,
      gap: SPACING.md,
    },
    fieldLabel: {
      fontSize: 14,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
    searchField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      height: 60,
      paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.lg,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    searchFieldActive: {
      borderColor: theme.textPrimary,
      borderWidth: 2,
    },
    searchInput: {
      flex: 1,
      fontSize: 17,
      fontFamily: FONTS.body,
      color: theme.textPrimary,
      // Android centres single-line inputs oddly without this.
      paddingVertical: 0,
    },
    clearButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.border,
    },
    mapButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      height: 56,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    mapButtonText: {
      fontSize: 16,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
    sectionLabel: {
      fontSize: 13,
      fontFamily: FONTS.bodySemibold,
      color: theme.textSecondary,
      letterSpacing: 0.6,
      marginTop: SPACING.sm,
    },
    resultsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
    rowHighlighted: {
      backgroundColor: theme.accentMuted,
    },
    savedIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pinIcon: {
      width: 24,
      alignItems: 'center',
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
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
    addAddressText: {
      fontSize: 15,
      fontFamily: FONTS.bodySemibold,
      color: theme.accent,
    },
    errorText: {
      fontSize: 14,
      fontFamily: FONTS.body,
      color: theme.critical.fg,
      paddingVertical: SPACING.xs,
    },
    emptyText: {
      fontSize: 15,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
      lineHeight: 21,
      paddingVertical: SPACING.sm,
    },
    tip: {
      fontSize: 15,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginTop: SPACING.xl,
      paddingHorizontal: SPACING.md,
    },
    tipStrong: {
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
  });
}
