import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { SPACING } from '../../config/theme';
import { PlaceButton } from '../glass';
import { useRoutePreview } from '../../hooks/useRoutePreview';
import type { Coordinates } from '../../models/Journey';
import type { SavedPlace } from '../../models/Place';

interface PlacesRowProps {
  places: SavedPlace[];
  from: Coordinates | null;
  onSelect(place: SavedPlace): void;
  onAdd(): void;
}

/**
 * Home's saved-places row (Option 15 `AI1`).
 *
 * Horizontally scrollable rather than a fixed four, because the set is the
 * user's and the design's "Home · Work · Alex's · School · + Add" is an example
 * of it, not a limit on it.
 */
export function PlacesRow({ places, from, onSelect, onAdd }: PlacesRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // A ScrollView grows to fill its cross axis by default. Horizontal, in a
      // column, that means it claims every remaining vertical pixel of the
      // sheet — which left a tall blank gap and pushed "Your circle" to the
      // bottom edge. flexGrow: 0 makes it take only the height its chips need.
      style={styles.row}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      // The row scrolls sideways inside a sheet that drags vertically; without
      // this the sheet steals the horizontal gesture on Android.
      directionalLockEnabled
    >
      {places.map((place) => (
        <PlaceWithEta key={place.id} place={place} from={from} onSelect={onSelect} />
      ))}
      <PlaceButton name="Add" kind="custom" isAddSlot onPress={onAdd} />
    </ScrollView>
  );
}

/**
 * One place, with its own route estimate.
 *
 * Each chip runs its own preview rather than the row computing all of them:
 * RoutingService caches per origin/destination/mode, so re-rendering Home does
 * not re-hit the routing API, and a place whose estimate hasn't resolved simply
 * renders without a caption instead of blocking the row.
 */
function PlaceWithEta({
  place,
  from,
  onSelect,
}: {
  place: SavedPlace;
  from: Coordinates | null;
  onSelect(place: SavedPlace): void;
}) {
  const preview = useRoutePreview(from, place.place?.coordinates ?? null, 'walk');

  return (
    <PlaceButton
      name={place.name}
      kind={place.kind}
      caption={place.place ? preview.formattedDuration : 'Add address'}
      onPress={() => onSelect(place)}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexGrow: 0,
  },
  content: {
    gap: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
});
