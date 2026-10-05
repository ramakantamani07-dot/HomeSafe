import type { SavedPlace, SavedPlaceKind, Place } from '../models/Place';

export interface NewSavedPlace {
  name: string;
  kind: SavedPlaceKind;
  /** Null creates a named slot with no address yet (screen 02's "+ Add address"). */
  place: Place | null;
  arrivalRadiusMeters: number;
}

export interface SavedPlaceUpdates {
  name?: string;
  place?: Place | null;
  arrivalRadiusMeters?: number;
}

/** Persistence for the user's "Your places" list (screens 02 / 03 / 04 / 10). */
export interface SavedPlaceProvider {
  listSavedPlaces(userId: string): Promise<SavedPlace[]>;
  addSavedPlace(userId: string, place: NewSavedPlace): Promise<SavedPlace>;
  updateSavedPlace(
    userId: string,
    placeId: string,
    updates: SavedPlaceUpdates,
  ): Promise<SavedPlace>;
  deleteSavedPlace(userId: string, placeId: string): Promise<void>;
}
