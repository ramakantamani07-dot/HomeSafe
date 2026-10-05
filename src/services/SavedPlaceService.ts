import type { Place, SavedPlace, SavedPlaceKind } from '../models/Place';
import { DEFAULT_ARRIVAL_RADIUS_METERS } from '../models/Place';
import type { SavedPlaceProvider, SavedPlaceUpdates } from '../providers/SavedPlaceProvider';

const MAX_NAME_LENGTH = 40;

export class SavedPlaceService {
  constructor(private readonly places: SavedPlaceProvider) {}

  async list(userId: string): Promise<SavedPlace[]> {
    return this.places.listSavedPlaces(userId);
  }

  /**
   * Saves a new place. Used by screen 04's "Save as a place" switch and
   * screen 10's "Save this place?" prompt, both of which save a destination
   * the user has just travelled to.
   */
  async save(
    userId: string,
    name: string,
    place: Place | null,
    kind: SavedPlaceKind = 'custom',
    arrivalRadiusMeters = DEFAULT_ARRIVAL_RADIUS_METERS,
  ): Promise<SavedPlace> {
    const trimmed = this.validateName(name);
    return this.places.addSavedPlace(userId, {
      name: trimmed,
      kind,
      place,
      arrivalRadiusMeters,
    });
  }

  /** Fills in the address for an existing named slot (screen 03). */
  async setAddress(
    userId: string,
    savedPlaceId: string,
    place: Place,
    name?: string,
    arrivalRadiusMeters?: number,
  ): Promise<SavedPlace> {
    const updates: SavedPlaceUpdates = { place };
    if (name !== undefined) updates.name = this.validateName(name);
    if (arrivalRadiusMeters !== undefined) updates.arrivalRadiusMeters = arrivalRadiusMeters;
    return this.places.updateSavedPlace(userId, savedPlaceId, updates);
  }

  async update(
    userId: string,
    savedPlaceId: string,
    updates: SavedPlaceUpdates,
  ): Promise<SavedPlace> {
    if (updates.name !== undefined) {
      return this.places.updateSavedPlace(userId, savedPlaceId, {
        ...updates,
        name: this.validateName(updates.name),
      });
    }
    return this.places.updateSavedPlace(userId, savedPlaceId, updates);
  }

  async remove(userId: string, savedPlaceId: string): Promise<void> {
    await this.places.deleteSavedPlace(userId, savedPlaceId);
  }

  /**
   * True when `place` is already saved — drives whether screen 04 shows the
   * "Save as a place" switch and whether screen 10 offers "Save this place?".
   * Matches on provider id first (the only reliable identity), falling back
   * to a ~25 m coordinate match for pin-dropped places, which have no id.
   */
  isAlreadySaved(place: Place, saved: SavedPlace[]): boolean {
    return saved.some((s) => {
      if (!s.place) return false;
      if (place.placeId && s.place.placeId) return s.place.placeId === place.placeId;
      return (
        Math.abs(s.place.coordinates.latitude - place.coordinates.latitude) < 0.00025 &&
        Math.abs(s.place.coordinates.longitude - place.coordinates.longitude) < 0.00025
      );
    });
  }

  private validateName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Give this place a name before saving.');
    if (trimmed.length > MAX_NAME_LENGTH) {
      throw new Error(`Place names must be ${MAX_NAME_LENGTH} characters or less.`);
    }
    return trimmed;
  }
}
