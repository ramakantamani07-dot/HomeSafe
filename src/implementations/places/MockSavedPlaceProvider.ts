import type { SavedPlace } from '../../models/Place';
import { DEFAULT_ARRIVAL_RADIUS_METERS } from '../../models/Place';
import type {
  NewSavedPlace,
  SavedPlaceProvider,
  SavedPlaceUpdates,
} from '../../providers/SavedPlaceProvider';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * In-memory saved places for dev mode.
 *
 * Seeds the exact list drawn in journey-flow board 02: Home with an address, Work
 * with an address, and School as a named slot with none — so the
 * "+ Add address → screen 03" branch of the flow is reachable on first run
 * without any setup.
 */
export class MockSavedPlaceProvider implements SavedPlaceProvider {
  private store = new Map<string, Map<string, SavedPlace>>();
  private nextId = 1;

  private userStore(userId: string): Map<string, SavedPlace> {
    let existing = this.store.get(userId);
    if (!existing) {
      existing = new Map();
      for (const seed of this.seedPlaces()) existing.set(seed.id, seed);
      this.store.set(userId, existing);
    }
    return existing;
  }

  private seedPlaces(): SavedPlace[] {
    const now = new Date();
    return [
      {
        id: 'seed-home',
        name: 'Home',
        kind: 'home',
        place: {
          name: 'Home',
          formattedAddress: '12 Acacia Avenue, London SE15 3PL',
          postcode: 'SE15 3PL',
          coordinates: { latitude: 51.4698, longitude: -0.0712 },
          placeId: 'mock-acacia-avenue',
        },
        arrivalRadiusMeters: DEFAULT_ARRIVAL_RADIUS_METERS,
        createdAt: now,
      },
      {
        id: 'seed-work',
        name: 'Work',
        kind: 'work',
        place: {
          name: 'Work',
          formattedAddress: '122 Peckham Hill Street, London SE15 5JR',
          postcode: 'SE15 5JR',
          coordinates: { latitude: 51.4739, longitude: -0.0686 },
          placeId: 'mock-peckham-library',
        },
        arrivalRadiusMeters: DEFAULT_ARRIVAL_RADIUS_METERS,
        createdAt: now,
      },
      {
        id: 'seed-school',
        name: 'School',
        kind: 'school',
        // Deliberately address-less — this is what renders "+ Add address".
        place: null,
        arrivalRadiusMeters: DEFAULT_ARRIVAL_RADIUS_METERS,
        createdAt: now,
      },
    ];
  }

  async listSavedPlaces(userId: string): Promise<SavedPlace[]> {
    await delay(150);
    return Array.from(this.userStore(userId).values()).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  async addSavedPlace(userId: string, place: NewSavedPlace): Promise<SavedPlace> {
    await delay(150);
    const saved: SavedPlace = {
      ...place,
      id: `mock-place-${this.nextId++}`,
      createdAt: new Date(),
    };
    this.userStore(userId).set(saved.id, saved);
    return saved;
  }

  async updateSavedPlace(
    userId: string,
    placeId: string,
    updates: SavedPlaceUpdates,
  ): Promise<SavedPlace> {
    await delay(150);
    const store = this.userStore(userId);
    const existing = store.get(placeId);
    if (!existing) throw new Error('That place no longer exists.');
    const updated: SavedPlace = { ...existing, ...updates, id: placeId };
    store.set(placeId, updated);
    return updated;
  }

  async deleteSavedPlace(userId: string, placeId: string): Promise<void> {
    await delay(150);
    this.userStore(userId).delete(placeId);
  }
}
