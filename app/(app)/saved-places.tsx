import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../src/config/theme';
import { usePlaces } from '../../src/hooks/usePlaces';
import { useJourneyDraft } from '../../src/context/JourneyDraftContext';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Button } from '../../src/components/ui/Button';
import { Icon, type IconName } from '../../src/components/ui/Icon';
import type { SavedPlace, SavedPlaceKind } from '../../src/models/Place';

const KIND_ICON: Record<SavedPlaceKind, IconName> = {
  home: 'home',
  work: 'briefcase',
  school: 'school',
  custom: 'location',
};

/**
 * Manage saved places — reached from Settings.
 *
 * Not part of the numbered journey flow, but the flow creates these records
 * from three different screens (02's "+ Add address", 04's "Save as a place",
 * 10's "Save this place?"), and there was no way to see or undo any of it.
 */
export default function SavedPlacesScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();

  const { savedPlaces, isLoading, removePlace } = usePlaces();
  const { setPendingAddressPlaceId } = useJourneyDraft();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleEdit = (place: SavedPlace) => {
    setPendingAddressPlaceId(place.id);
    router.push('/(app)/add-place');
  };

  const handleDelete = (place: SavedPlace) => {
    Alert.alert(
      `Remove ${place.name}?`,
      'Journeys you have already made keep their history. Only the shortcut is removed.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setBusyId(place.id);
            try {
              await removePlace(place.id);
            } catch {
              Alert.alert('Error', "Couldn't remove that place. Please try again.");
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Saved places" onBack={() => router.back()} titleLines={1} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : savedPlaces.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="location" size={48} color={theme.textTertiary} />
            <Text style={styles.emptyTitle}>No saved places</Text>
            <Text style={styles.emptyText}>
              Save the places you go to often and starting a journey there becomes one tap.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {savedPlaces.map((place, index) => (
              <View
                key={place.id}
                style={[styles.row, index < savedPlaces.length - 1 && styles.rowDivider]}
              >
                <View
                  style={[
                    styles.icon,
                    { backgroundColor: place.place ? theme.accentMuted : theme.border },
                  ]}
                >
                  <Icon
                    name={KIND_ICON[place.kind]}
                    size={20}
                    color={place.place ? theme.accent : theme.textSecondary}
                  />
                </View>

                <TouchableOpacity
                  style={styles.rowText}
                  onPress={() => handleEdit(place)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={
                    place.place
                      ? `Edit ${place.name}, ${place.place.formattedAddress}`
                      : `Add an address for ${place.name}`
                  }
                >
                  <Text style={styles.rowTitle} numberOfLines={1}>{place.name}</Text>
                  {place.place ? (
                    <Text style={styles.rowSubtitle} numberOfLines={1}>
                      {place.place.formattedAddress} · arrive within {place.arrivalRadiusMeters} m
                    </Text>
                  ) : (
                    <Text style={styles.addAddress}>+ Add address</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleDelete(place)}
                  disabled={busyId === place.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${place.name}`}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  {busyId === place.id ? (
                    <ActivityIndicator size="small" color={theme.textSecondary} />
                  ) : (
                    <Icon name="trash" size={20} color={theme.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <Button
          label="Add a place"
          icon="add"
          variant="secondary"
          onPress={() => {
            setPendingAddressPlaceId(null);
            router.push('/(app)/add-place');
          }}
          style={styles.addButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    container: {
      paddingHorizontal: SPACING.xl,
      paddingBottom: SPACING.xxxl,
      gap: SPACING.lg,
    },
    centered: { paddingVertical: SPACING.xxxl, alignItems: 'center' },
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
    icon: {
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
      fontSize: 14,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    addAddress: {
      fontSize: 15,
      fontFamily: FONTS.bodySemibold,
      color: theme.accent,
    },
    addButton: { backgroundColor: theme.surface },
    empty: {
      alignItems: 'center',
      gap: SPACING.md,
      paddingVertical: SPACING.xxxl,
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
    },
  });
}
