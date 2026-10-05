import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { ELEVATION, FONTS, RADIUS, SPACING, type ThemeColors } from '../../src/config/theme';
import { useJourneyDraft } from '../../src/context/JourneyDraftContext';
import { usePlaces } from '../../src/hooks/usePlaces';
import { usePlaceSearch } from '../../src/hooks/usePlaceSearch';
import { useActiveJourneyLocation } from '../../src/hooks/useActiveJourneyLocation';
import { useFamily } from '../../src/hooks/useFamily';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Button } from '../../src/components/ui/Button';
import { Icon } from '../../src/components/ui/Icon';
import { AppMapView } from '../../src/components/map/AppMapView';
import { joinGuardianNames } from '../../src/utils/guardians';
import {
  ARRIVAL_RADIUS_OPTIONS_METERS,
  DEFAULT_ARRIVAL_RADIUS_METERS,
  type Place,
  type PlaceSuggestion,
} from '../../src/models/Place';

/**
 * Screen 03 — "Add address for <place>".
 *
 * Reached from screen 02's "+ Add address" on a saved place with no address,
 * and from the map picker when a dropped pin should become a saved place.
 * Saving returns to 02 with the place highlighted (JOURNEY_FLOW_SPEC §3).
 */
export default function AddPlaceScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();

  const { savedPlaces, setPlaceAddress, savePlace } = usePlaces();
  const { placesService } = usePlaces();
  const {
    pendingAddressPlaceId,
    setPendingAddressPlaceId,
    setHighlightedPlaceId,
    pendingPin,
    setPendingPin,
  } = useJourneyDraft();
  const { currentLocation } = useActiveJourneyLocation();
  const { members } = useFamily();

  const target = savedPlaces.find((p) => p.id === pendingAddressPlaceId) ?? null;

  const [name, setName] = useState(target?.name ?? '');
  const [place, setPlace] = useState<Place | null>(target?.place ?? null);
  const [arrivalRadius, setArrivalRadius] = useState(
    target?.arrivalRadiusMeters ?? DEFAULT_ARRIVAL_RADIUS_METERS,
  );
  const [isPicking, setIsPicking] = useState(!target?.place);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const searchState = usePlaceSearch(currentLocation);

  /**
   * A pin dropped by the map picker, turned into a named Place.
   *
   * Consumed (cleared) as soon as it's picked up, so re-entering this screen
   * later doesn't re-apply a stale pin. Deliberately not gated on `place`
   * being empty: "Adjust pin" comes back here with a place already set, and
   * ignoring the new coordinates would silently discard the adjustment the
   * user just made.
   */
  useEffect(() => {
    if (!pendingPin) return;
    const coordinates = pendingPin;
    setPendingPin(null);

    let cancelled = false;
    void placesService
      .describeCoordinates(coordinates)
      .then((described) => {
        if (cancelled) return;
        setPlace(described);
        setIsPicking(false);
        // Only fill the name if the user hasn't chosen one — re-pinning
        // "School" must not rename it to whatever the geocoder says.
        setName((current) => current || described.name);
      })
      .catch(() => {
        if (cancelled) return;
        // The pin is still perfectly usable without a street name.
        setPlace({
          name: 'Dropped pin',
          formattedAddress: `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`,
          postcode: null,
          coordinates,
          placeId: null,
        });
        setIsPicking(false);
      });
    return () => { cancelled = true; };
  }, [pendingPin, setPendingPin, placesService]);

  // The saved place may still be loading when this screen mounts (a cold
  // start, or a deep link straight here), in which case the state above was
  // seeded from nothing. Fill it in once the record actually arrives, without
  // clobbering anything the user has already typed or picked.
  const seededTargetRef = useRef<string | null>(null);
  useEffect(() => {
    if (!target || seededTargetRef.current === target.id) return;
    seededTargetRef.current = target.id;
    setName((current) => current || target.name);
    setArrivalRadius(target.arrivalRadiusMeters);
    if (target.place) {
      setPlace((current) => current ?? target.place);
      setIsPicking(false);
    }
  }, [target]);

  const guardians = useMemo(() => joinGuardianNames(members), [members]);

  const handleSuggestion = async (suggestion: PlaceSuggestion) => {
    setError(null);
    setResolvingId(suggestion.placeId);
    try {
      const resolved = await placesService.resolve(suggestion);
      setPlace(resolved);
      setIsPicking(false);
      searchState.clear();
      if (!name.trim()) setName(resolved.name);
    } catch {
      setError("We couldn't get the details for that place. Try another result.");
    } finally {
      setResolvingId(null);
    }
  };

  const handleSave = async () => {
    if (!place) {
      setError('Choose an address before saving.');
      return;
    }
    if (!name.trim()) {
      setError('Give this place a name.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = target
        ? await setPlaceAddress(target.id, place, name, arrivalRadius)
        : await savePlace(name, place, 'custom', arrivalRadius);

      setPendingAddressPlaceId(null);
      // Screen 02 highlights the row that was just completed.
      setHighlightedPlaceId(saved.id);
      router.back();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save that place. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    setPendingAddressPlaceId(null);
    router.back();
  };

  // "Add address for School" only reads right the first time; editing one
  // that already has an address is not adding anything.
  const title = target
    ? target.place
      ? `Edit ${target.name}`
      : `Add address for ${target.name}`
    : 'Add a place';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader title={title} onBack={handleBack} />

        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {isPicking || !place ? (
            <>
              <Text style={styles.fieldLabel}>Address or postcode</Text>
              <View style={styles.searchField}>
                <Icon name="search" size={20} color={theme.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  value={searchState.query}
                  onChangeText={searchState.setQuery}
                  placeholder="Search for the address"
                  placeholderTextColor={theme.textTertiary}
                  autoFocus
                  autoCorrect={false}
                  accessibilityLabel="Search for the address"
                />
                {searchState.isSearching && (
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                )}
              </View>

              <TouchableOpacity
                style={styles.mapButton}
                onPress={() => router.push('/(app)/map-picker?mode=place')}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Icon name="map" size={20} color={theme.textPrimary} />
                <Text style={styles.mapButtonText}>Choose on map instead</Text>
              </TouchableOpacity>

              {searchState.error && <Text style={styles.errorText}>{searchState.error}</Text>}
              {searchState.isEmpty && (
                <Text style={styles.emptyText}>
                  No places matched "{searchState.query.trim()}". Try a postcode.
                </Text>
              )}

              {searchState.results.length > 0 && (
                <View style={styles.list}>
                  {searchState.results.map((suggestion, index) => (
                    <TouchableOpacity
                      key={suggestion.placeId}
                      style={[
                        styles.row,
                        index < searchState.results.length - 1 && styles.rowDivider,
                      ]}
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
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          ) : (
            <>
              {/* Chosen address, with the map preview and the "Adjust pin" /
                  "Change" affordances from the design. */}
              <View style={styles.previewCard}>
                <View style={styles.mapPreview}>
                  <AppMapView
                    region={{
                      latitude: place.coordinates.latitude,
                      longitude: place.coordinates.longitude,
                      latitudeDelta: 0.006,
                      longitudeDelta: 0.006,
                    }}
                    markers={[
                      {
                        id: 'place',
                        coordinate: place.coordinates,
                        title: place.name,
                        role: 'destination',
                      },
                    ]}
                    polyline={null}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <TouchableOpacity
                    style={styles.adjustPin}
                    onPress={() => router.push('/(app)/map-picker?mode=place')}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Adjust the pin position on the map"
                  >
                    <Text style={styles.adjustPinText}>Adjust pin</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.previewFooter}>
                  <View style={styles.previewText}>
                    <Text style={styles.previewName} numberOfLines={1}>{place.name}</Text>
                    <Text style={styles.previewAddress} numberOfLines={2}>
                      {place.formattedAddress}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setIsPicking(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Change the address"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.linkText}>Change</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={(t) => { setName(t); if (error) setError(null); }}
                placeholder="e.g. School"
                placeholderTextColor={theme.textTertiary}
                maxLength={40}
                accessibilityLabel="Name for this place"
              />

              <Text style={styles.helperText}>
                This is what {guardians} will see: "you're on the way to{' '}
                {name.trim() || 'this place'}".
              </Text>

              <View style={styles.radiusRow}>
                <Text style={styles.helperText}>
                  You'll count as arrived within {arrivalRadius} m.
                </Text>
              </View>
              <View style={styles.radiusOptions}>
                {ARRIVAL_RADIUS_OPTIONS_METERS.map((option) => {
                  const selected = option === arrivalRadius;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[styles.radiusChip, selected && styles.radiusChipSelected]}
                      onPress={() => setArrivalRadius(option)}
                      activeOpacity={0.75}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Arrival radius ${option} metres`}
                    >
                      <Text style={[styles.radiusChipText, selected && styles.radiusChipTextSelected]}>
                        {option} m
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}
        </ScrollView>

        {place && !isPicking && (
          <View style={styles.footer}>
            <Button label="Save place" variant="strong" onPress={handleSave} loading={saving} />
          </View>
        )}
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
      paddingBottom: SPACING.xxl,
      gap: SPACING.md,
    },
    fieldLabel: {
      fontSize: 16,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
      marginTop: SPACING.sm,
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
    searchInput: {
      flex: 1,
      fontSize: 17,
      fontFamily: FONTS.body,
      color: theme.textPrimary,
      paddingVertical: 0,
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
    pinIcon: { width: 24, alignItems: 'center' },
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
    previewCard: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.xl,
      overflow: 'hidden',
    },
    mapPreview: {
      height: 220,
      backgroundColor: theme.border,
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
      padding: SPACING.md,
    },
    adjustPin: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.pill,
      backgroundColor: theme.surface,
      ...ELEVATION.float,
    },
    adjustPinText: {
      fontSize: 15,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
    previewFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.md,
      padding: SPACING.lg,
    },
    previewText: { flex: 1, gap: 2 },
    previewName: {
      fontSize: 18,
      fontFamily: FONTS.heading,
      color: theme.textPrimary,
    },
    previewAddress: {
      fontSize: 15,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    linkText: {
      fontSize: 16,
      fontFamily: FONTS.bodySemibold,
      color: theme.accent,
    },
    nameInput: {
      height: 60,
      paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      fontSize: 17,
      fontFamily: FONTS.body,
      color: theme.textPrimary,
    },
    helperText: {
      fontSize: 15,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
      lineHeight: 21,
    },
    radiusRow: { marginTop: SPACING.xs },
    radiusOptions: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    radiusChip: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm + 2,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    radiusChipSelected: {
      backgroundColor: theme.strong,
      borderColor: theme.strong,
    },
    radiusChipText: {
      fontSize: 14,
      fontFamily: FONTS.bodySemibold,
      color: theme.textSecondary,
    },
    radiusChipTextSelected: {
      color: theme.strongText,
    },
    errorText: {
      fontSize: 14,
      fontFamily: FONTS.body,
      color: theme.critical.fg,
      lineHeight: 20,
    },
    emptyText: {
      fontSize: 15,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
      lineHeight: 21,
    },
    footer: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.lg,
      backgroundColor: theme.background,
    },
  });
}
