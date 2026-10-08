import { searchNearby } from '../../../modules/nearby-places';
import type { Coordinates } from '../../models/Journey';
import type { SafePlace, SafePlaceKind } from '../../models/SafePlace';
import {
  SAFE_PLACE_CATEGORIES,
  SAFE_PLACE_CATEGORY_IDS,
  SAFE_PLACE_LIMIT,
  SAFE_PLACE_RADIUS_METERS,
  rankSafePlaces,
} from '../../models/SafePlace';
import type { SafePlaceProvider } from '../../providers/SafePlaceProvider';

/**
 * Nearby places via MapKit's MKLocalSearch — free, keyless, iOS only.
 *
 * The native side returns raw MapKit rows; everything about *which* categories
 * we trust and how they rank lives in models/SafePlace.ts, so that policy is
 * testable without a device.
 */
export class MapKitSafePlaceProvider implements SafePlaceProvider {
  async findNearby(near: Coordinates): Promise<SafePlace[]> {
    const rows = await searchNearby(
      SAFE_PLACE_CATEGORY_IDS,
      near.latitude,
      near.longitude,
      SAFE_PLACE_RADIUS_METERS,
      SAFE_PLACE_LIMIT,
    );

    const places: SafePlace[] = [];

    for (const [index, row] of rows.entries()) {
      const kind: SafePlaceKind | undefined = row.category
        ? SAFE_PLACE_CATEGORIES[row.category]
        : undefined;

      // A row we cannot name, place, or categorise is a row we cannot send
      // someone to. Dropped rather than rendered as a blank entry.
      if (!kind || !row.name || row.latitude === null || row.longitude === null) continue;

      places.push({
        id: `mapkit-${index}-${row.latitude.toFixed(5)},${row.longitude.toFixed(5)}`,
        name: row.name,
        kind,
        coordinates: { latitude: row.latitude, longitude: row.longitude },
        distanceMeters: Math.round(row.distanceMeters),
        phoneNumber: row.phoneNumber,
      });
    }

    return rankSafePlaces(places);
  }
}
