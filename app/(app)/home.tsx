import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../src/config/theme';
import { useAuth } from '../../src/hooks/useAuth';
import { useJourney } from '../../src/hooks/useJourney';
import { useSOS } from '../../src/hooks/useSOS';
import { useFakeCall } from '../../src/hooks/useFakeCall';
import { useFamily } from '../../src/hooks/useFamily';
import { useCurrentPosition } from '../../src/hooks/useCurrentPosition';
import { usePlaceSearch } from '../../src/hooks/usePlaceSearch';
import { usePrivacy } from '../../src/hooks/usePrivacy';
import { usePlaces } from '../../src/hooks/usePlaces';
import { useRoutePreview } from '../../src/hooks/useRoutePreview';
import { useJourneyDraft } from '../../src/context/JourneyDraftContext';
import { AppMapView } from '../../src/components/map/AppMapView';
import { Icon } from '../../src/components/ui/Icon';
import {
  GlassPill,
  MapSheet,
  SafetyDock,
  type MapSheetHandle,
  type SheetDetentIndex,
} from '../../src/components/glass';
import { SearchRow } from '../../src/components/home/SearchRow';
import { PlacesRow } from '../../src/components/home/PlacesRow';
import { CircleList } from '../../src/components/home/CircleList';
import { SearchResults } from '../../src/components/home/SearchResults';
import { SHEET_DETENT } from '../../src/navigation/sheetPresentation';
import { joinGuardianNames } from '../../src/utils/guardians';
import type { Place, PlaceSuggestion, SavedPlace } from '../../src/models/Place';

/** Central London, used only until the first location fix arrives. */
const FALLBACK_REGION = {
  latitude: 51.5074,
  longitude: -0.1278,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

/**
 * Home — a full-screen map with a persistent pull-up sheet (Option 15 `AI1`).
 *
 * The sheet is part of this screen rather than a presented modal: tapping
 * "Where to?" expands the same sheet to full height instead of pushing a route,
 * which is what lets the typed query survive a collapse. See MapSheet for why
 * that cannot be the OS sheet.
 *
 * This file stays a composition root. The sheet's contents live in
 * `src/components/home/`, so nothing here grows back into the 873-line screen
 * it replaced.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { user } = useAuth();
  const { activeJourney } = useJourney();
  const { activeSOS, isSOSLoading } = useSOS();
  const { startFakeCall } = useFakeCall();
  const { members } = useFamily();
  const { savedPlaces } = usePlaces();
  const { position } = useCurrentPosition();
  const { locationStatus } = usePrivacy();
  const { reset, setDestination } = useJourneyDraft();

  const sheetRef = useRef<MapSheetHandle>(null);
  const inputRef = useRef<TextInput>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [busyPlaceId, setBusyPlaceId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const { startJourney } = useJourney();
  const { placesService } = usePlaces();
  const search = usePlaceSearch(position);
  const query = search.query;

  /**
   * A real route for the top result only.
   *
   * The design shows a time on every row, but one routing call per keystroke
   * per result would be both slow and, on a metered provider, expensive. The
   * first hit is what people actually take, so it gets the real number and the
   * rest show distance — an honest difference rather than three estimates
   * dressed as routed times.
   */
  const topResult = search.results[0] ?? null;
  const topPreview = useRoutePreview(
    position,
    topResult?.resolved?.coordinates ?? null,
    'walk',
  );

  const guardians = useMemo(() => joinGuardianNames(members), [members]);

  // Already mid-SOS (the app was relaunched during one) — go straight back
  // rather than showing a calm map.
  useEffect(() => {
    if (!isSOSLoading && activeSOS) router.replace('/(app)/emergency-mode');
  }, [activeSOS, isSOSLoading, router]);

  const expandForSearch = useCallback(() => {
    setIsSearching(true);
    sheetRef.current?.snapTo(SHEET_DETENT.full);
  }, []);

  const collapseSearch = useCallback(() => {
    setIsSearching(false);
    inputRef.current?.blur();
    sheetRef.current?.snapTo(SHEET_DETENT.half);
  }, []);

  // Dragging the sheet back down is also a way out of search — otherwise the
  // keyboard would stay up over a half-height sheet.
  const handleDetentChange = useCallback(
    (detent: SheetDetentIndex) => {
      if (detent !== SHEET_DETENT.full && isSearching) {
        setIsSearching(false);
        inputRef.current?.blur();
      }
    },
    [isSearching],
  );

  /** Resolves a suggestion to a full Place, with its coordinates and postcode. */
  const resolveSuggestion = useCallback(
    async (suggestion: PlaceSuggestion): Promise<Place | null> => {
      setStartError(null);
      setBusyPlaceId(suggestion.placeId);
      try {
        return await placesService.resolve(suggestion);
      } catch {
        setStartError("We couldn't get the details for that place. Try another result.");
        return null;
      } finally {
        setBusyPlaceId(null);
      }
    },
    [placesService],
  );

  /** "Go" — starts immediately on the saved defaults, skipping review (§3B). */
  const handleGo = useCallback(
    async (suggestion: PlaceSuggestion) => {
      const destination = await resolveSuggestion(suggestion);
      if (!destination) return;

      // Permission is the one thing that cannot be defaulted — screen 05
      // explains why before the OS asks, so route through review when it is
      // missing rather than failing at the point of starting.
      if (locationStatus !== 'granted') {
        setDestination(destination, { origin: 'home' });
        router.push('/(app)/allow-location');
        return;
      }

      try {
        await startJourney({ destination });
        collapseSearch();
        router.push('/(app)/active-journey');
      } catch (err: unknown) {
        setStartError(
          err instanceof Error ? err.message : 'Could not start the journey. Please try again.',
        );
      }
    },
    [resolveSuggestion, locationStatus, setDestination, startJourney, router, collapseSearch],
  );

  /** "Directions" — opens review so the route can be checked first (§3B). */
  const handleDirections = useCallback(
    async (suggestion: PlaceSuggestion) => {
      const destination = await resolveSuggestion(suggestion);
      if (!destination) return;
      setDestination(destination, { origin: 'home' });
      collapseSearch();
      router.push('/(app)/route');
    },
    [resolveSuggestion, setDestination, router, collapseSearch],
  );

  const handleSelectPlace = useCallback(
    (place: SavedPlace) => {
      if (!place.place) {
        // A named slot with no address yet — screen 03 fills it in.
        router.push('/(app)/add-place');
        return;
      }
      setDestination(place.place, {
        savedPlaceId: place.id,
        origin: 'home',
        arrivalRadiusMeters: place.arrivalRadiusMeters,
      });
      router.push('/(app)/review-journey');
    },
    [router, setDestination],
  );

  const mapRegion = position
    ? { ...position, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : FALLBACK_REGION;

  return (
    <View style={styles.root}>
      <AppMapView
        region={mapRegion}
        // Option 15 §1: Home is a map you can explore, not a backdrop — it stays
        // draggable with the sheet at any detent. The camera follows your
        // location until you first pan it, then it is yours (see
        // ReactNativeMapsProvider).
        interactive
        markers={
          position
            ? [{ id: 'me', coordinate: position, title: 'You', role: 'current' as const }]
            : []
        }
        polyline={null}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Floating glass controls. box-none keeps the map draggable around them. */}
      <View style={[styles.floating, { top: insets.top + SPACING.sm }]} pointerEvents="box-none">
        <GlassPill style={styles.guardianPill}>
          <View style={styles.guardianRow}>
            <View style={[styles.liveDot, { backgroundColor: theme.safe.fg }]} />
            <Text style={styles.guardianText} numberOfLines={1}>
              {members.length > 0 ? `${guardians} · on call` : 'No guardians yet'}
            </Text>
          </View>
        </GlassPill>

        <GlassPill
          onPress={() => router.push('/(app)/saved-places')}
          accessibilityLabel="Saved places"
        >
          <Icon name="layers" size={20} color={theme.textPrimary} />
        </GlassPill>
      </View>

      <MapSheet
        handleRef={sheetRef}
        onDetentChange={handleDetentChange}
        header={
          <View style={styles.sheetHeader}>
            <SearchRow
              inputRef={inputRef}
              value={query}
              onChangeText={search.setQuery}
              onFocus={expandForSearch}
              onClear={search.clear}
              onCollapse={collapseSearch}
              isSearching={isSearching}
              avatarInitial={user?.name?.[0]?.toUpperCase() ?? '?'}
              onOpenSettings={() => router.push('/(app)/settings')}
            />

            {/* Pinned in the header so it never scrolls away — §1 principle 3
                puts the dock in the same place on Home and On the way. */}
            <SafetyDock
              style={styles.dock}
              checkInLabel={activeJourney ? "I'm OK" : 'Check in'}
              onCheckIn={() =>
                router.push(activeJourney ? '/(app)/active-journey' : '/(app)/where-to')
              }
              onFakeCall={() => {
                startFakeCall();
                router.push('/(app)/fake-incoming-call');
              }}
            />
          </View>
        }
      >
        {isSearching ? (
          <>
            {startError && <Text style={styles.errorText}>{startError}</Text>}
            <SearchResults
              results={search.results}
              isSearching={search.isSearching}
              error={search.error}
              isEmpty={search.isEmpty}
              query={query}
              topDuration={topPreview.formattedDuration}
              topArrival={topPreview.formattedEta}
              guardians={members.length > 0 ? guardians : 'Nobody yet — add a guardian'}
              onGo={handleGo}
              onDirections={handleDirections}
              busyPlaceId={busyPlaceId}
            />
          </>
        ) : (
          <>
        {activeJourney && (
          <TouchableOpacity
            style={styles.journeyChip}
            onPress={() => router.push('/(app)/active-journey')}
            accessibilityRole="button"
            accessibilityLabel="Journey running — open it"
          >
            <View style={[styles.liveDot, { backgroundColor: theme.accent }]} />
            <Text style={styles.journeyChipText} numberOfLines={1}>
              Journey running · {activeJourney.destination?.name ?? activeJourney.destinationLabel}
            </Text>
            <Icon name="chevronRight" size={16} color={theme.accent} />
          </TouchableOpacity>
        )}

        <PlacesRow
          places={savedPlaces}
          from={position}
          onSelect={handleSelectPlace}
          onAdd={() => {
            reset();
            router.push('/(app)/add-place');
          }}
        />

        <CircleList
          members={members}
          onOpenMember={(member) =>
            router.push({
              pathname: '/(app)/family-member',
              params: { connectionId: member.connectionId },
            })
          }
          onCall={(member) =>
            router.push({
              pathname: '/(app)/family-member',
              params: { connectionId: member.connectionId },
            })
          }
        />
          </>
        )}
      </MapSheet>
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    floating: {
      position: 'absolute',
      left: SPACING.lg,
      right: SPACING.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    guardianPill: { flex: 1 },
    guardianRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    liveDot: { width: 8, height: 8, borderRadius: 4 },
    guardianText: {
      flex: 1,
      fontSize: 15,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
    sheetHeader: {
      gap: SPACING.md,
      paddingBottom: SPACING.md,
    },
    dock: { paddingHorizontal: SPACING.lg },
    journeyChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.sm,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.pill,
      backgroundColor: theme.accentMuted,
    },
    errorText: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: FONTS.body,
      color: theme.critical.fg,
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.sm,
    },
    journeyChipText: {
      flex: 1,
      fontSize: 15,
      fontFamily: FONTS.bodySemibold,
      color: theme.accent,
    },
  });
}
