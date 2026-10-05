/**
 * Places Tests
 *
 * Covers the rules JOURNEY_FLOW_SPEC §3 puts on destination input — minimum
 * query length, postcode handling, distance ranking, stale-response
 * discarding — plus the SavedPlaceService logic that decides whether screens
 * 04 and 10 offer to save a place.
 *
 * Pure unit tests: no React, no network.
 */

import { PlacesService, MIN_QUERY_LENGTH } from '../services/PlacesService';
import { SavedPlaceService } from '../services/SavedPlaceService';
import { MockPlacesProvider } from '../implementations/places/MockPlacesProvider';
import { MockSavedPlaceProvider } from '../implementations/places/MockSavedPlaceProvider';
import type { PlacesProvider } from '../providers/PlacesProvider';
import type { Coordinates } from '../models/Journey';
import type { Place, PlaceSuggestion, SavedPlace } from '../models/Place';
import {
  formatDistance,
  formatPostcode,
  haversineMeters,
  isFullPostcode,
  looksLikePostcode,
} from '../models/Place';

const NEAR: Coordinates = { latitude: 51.4712, longitude: -0.0685 };

function place(overrides: Partial<Place> = {}): Place {
  return {
    name: 'Somewhere',
    formattedAddress: 'A Street, London SE1 1AA',
    postcode: 'SE1 1AA',
    coordinates: { latitude: 51.5, longitude: -0.1 },
    placeId: 'test-place',
    ...overrides,
  };
}

function savedPlace(overrides: Partial<SavedPlace> = {}): SavedPlace {
  return {
    id: 'saved-1',
    name: 'Home',
    kind: 'home',
    place: place(),
    arrivalRadiusMeters: 100,
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Postcode helpers ────────────────────────────────────────────────────────

describe('postcode helpers', () => {
  it('recognises full and outward-only UK postcodes', () => {
    expect(looksLikePostcode('SE15 4AB')).toBe(true);
    expect(looksLikePostcode('se154ab')).toBe(true);
    expect(looksLikePostcode('SE15')).toBe(true);
    expect(looksLikePostcode('EC1A 1BB')).toBe(true);
    expect(looksLikePostcode('Riverside School')).toBe(false);
    expect(looksLikePostcode('12 Acacia Avenue')).toBe(false);
  });

  it('distinguishes a complete postcode from an outward code', () => {
    expect(isFullPostcode('SE15 4AB')).toBe(true);
    expect(isFullPostcode('SE15')).toBe(false);
  });

  it('normalises spacing and case for display', () => {
    expect(formatPostcode('se154ab')).toBe('SE15 4AB');
    expect(formatPostcode('  EC1A1BB ')).toBe('EC1A 1BB');
  });

  it('formats distances without inventing precision', () => {
    expect(formatDistance(null)).toBeNull();
    expect(formatDistance(1_400)).toBe('1.4 km');
    expect(formatDistance(620)).toBe('620 m');
  });
});

// ─── PlacesService ───────────────────────────────────────────────────────────

describe('PlacesService', () => {
  it(`returns nothing below ${MIN_QUERY_LENGTH} characters, without calling the provider`, async () => {
    let calls = 0;
    const provider: PlacesProvider = {
      searchPlaces: async () => { calls++; return []; },
      getPlaceDetails: async () => place(),
      reverseGeocode: async () => place(),
    };
    const service = new PlacesService(provider);

    expect(await service.search('ri', NEAR)).toEqual([]);
    expect(await service.search('  ', NEAR)).toEqual([]);
    expect(calls).toBe(0);

    await service.search('riv', NEAR);
    expect(calls).toBe(1);
  });

  it('finds fixture places by name and by keyword', async () => {
    const service = new PlacesService(new MockPlacesProvider());
    const results = await service.search('riverside', NEAR);

    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.map((r) => r.primaryText)).toEqual(
      expect.arrayContaining([
        'Riverside Primary School',
        'Riverside Secondary School',
        'Riverside Nursery School',
      ]),
    );
  });

  it('returns every address at a full postcode', async () => {
    const service = new PlacesService(new MockPlacesProvider());
    const results = await service.search('SE15 4AB', NEAR);

    expect(results.length).toBeGreaterThan(1);
    for (const result of results) {
      expect(result.resolved?.postcode).toBe('SE15 4AB');
    }
  });

  it('matches an outward-only postcode by prefix, so results appear while typing', async () => {
    const service = new PlacesService(new MockPlacesProvider());
    const results = await service.search('SE15', NEAR);

    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.resolved?.postcode?.startsWith('SE15')).toBe(true);
    }
  });

  it('ranks resolved results by distance from the user', async () => {
    const service = new PlacesService(new MockPlacesProvider());
    const results = await service.search('school', NEAR);

    const distances = results.map((r) => r.distanceMeters).filter((d): d is number => d !== null);
    expect(distances.length).toBe(results.length);

    const sorted = [...distances].sort((a, b) => a - b);
    expect(distances).toEqual(sorted);
  });

  it('omits distance entirely when the user position is unknown', async () => {
    const service = new PlacesService(new MockPlacesProvider());
    const results = await service.search('riverside', null);

    for (const result of results) {
      expect(result.distanceMeters).toBeNull();
    }
  });

  it('discards a slow response once a newer search has started', async () => {
    const provider: PlacesProvider = {
      searchPlaces: async (query) => {
        // The first query resolves late; the second overtakes it.
        const delayMs = query === 'slow' ? 60 : 5;
        await new Promise((r) => setTimeout(r, delayMs));
        return [
          {
            placeId: query,
            primaryText: query,
            secondaryText: '',
            distanceMeters: null,
            resolved: null,
          } satisfies PlaceSuggestion,
        ];
      },
      getPlaceDetails: async () => place(),
      reverseGeocode: async () => place(),
    };
    const service = new PlacesService(provider);

    const stale = service.search('slow', NEAR);
    const fresh = await service.search('fast', NEAR);

    expect(fresh[0].primaryText).toBe('fast');
    await expect(stale).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('skips the details round-trip for suggestions that already carry coordinates', async () => {
    let detailCalls = 0;
    const resolved = place();
    const provider: PlacesProvider = {
      searchPlaces: async () => [],
      getPlaceDetails: async () => { detailCalls++; return resolved; },
      reverseGeocode: async () => resolved,
    };
    const service = new PlacesService(provider);

    const withCoords: PlaceSuggestion = {
      placeId: 'x',
      primaryText: 'x',
      secondaryText: '',
      distanceMeters: null,
      resolved,
    };
    expect(await service.resolve(withCoords)).toBe(resolved);
    expect(detailCalls).toBe(0);

    await service.resolve({ ...withCoords, resolved: null });
    expect(detailCalls).toBe(1);
  });

  it('names a dropped pin even when it matches no known place', async () => {
    const service = new PlacesService(new MockPlacesProvider());
    const described = await service.describeCoordinates({ latitude: 40.0, longitude: -3.0 });

    expect(described.coordinates).toEqual({ latitude: 40.0, longitude: -3.0 });
    expect(described.placeId).toBeNull();
    expect(described.name).toBeTruthy();
  });

  it('keeps the exact coordinates the user pinned when one is recognised', async () => {
    const service = new PlacesService(new MockPlacesProvider());
    // ~30 m from the Riverside Primary School fixture.
    const pinned = { latitude: 51.47145, longitude: -0.06855 };
    const described = await service.describeCoordinates(pinned);

    expect(described.name).toBe('Riverside Primary School');
    expect(described.coordinates).toEqual(pinned);
  });
});

// ─── SavedPlaceService ───────────────────────────────────────────────────────

describe('SavedPlaceService', () => {
  const USER = 'user-1';

  it('seeds Home, Work and an address-less School', async () => {
    const service = new SavedPlaceService(new MockSavedPlaceProvider());
    const places = await service.list(USER);

    expect(places.map((p) => p.name)).toEqual(['Home', 'Work', 'School']);
    // The address-less slot is what renders "+ Add address" on screen 02.
    expect(places.find((p) => p.name === 'School')?.place).toBeNull();
  });

  it('fills in an address for an existing named slot', async () => {
    const service = new SavedPlaceService(new MockSavedPlaceProvider());
    const before = await service.list(USER);
    const school = before.find((p) => p.name === 'School')!;

    const updated = await service.setAddress(USER, school.id, place({ name: 'Riverside Primary' }));

    expect(updated.place).not.toBeNull();
    expect(updated.name).toBe('School');
  });

  it('rejects blank and over-long names', async () => {
    const service = new SavedPlaceService(new MockSavedPlaceProvider());

    await expect(service.save(USER, '   ', place())).rejects.toThrow(/name/i);
    await expect(service.save(USER, 'x'.repeat(41), place())).rejects.toThrow(/40 characters/);
  });

  it('matches an already-saved place by provider id', () => {
    const service = new SavedPlaceService(new MockSavedPlaceProvider());
    const saved = [savedPlace({ place: place({ placeId: 'abc' }) })];

    expect(service.isAlreadySaved(place({ placeId: 'abc' }), saved)).toBe(true);
    expect(service.isAlreadySaved(place({ placeId: 'different' }), saved)).toBe(false);
  });

  it('matches a pin-dropped place by proximity, since it has no id', () => {
    const service = new SavedPlaceService(new MockSavedPlaceProvider());
    const saved = [
      savedPlace({
        place: place({ placeId: null, coordinates: { latitude: 51.5, longitude: -0.1 } }),
      }),
    ];

    // ~10 m away — the same doorway, from the user's point of view.
    const nearby = place({ placeId: null, coordinates: { latitude: 51.50009, longitude: -0.1 } });
    expect(service.isAlreadySaved(nearby, saved)).toBe(true);

    // ~500 m away — a different place.
    const faraway = place({ placeId: null, coordinates: { latitude: 51.5045, longitude: -0.1 } });
    expect(service.isAlreadySaved(faraway, saved)).toBe(false);
  });

  it('never treats an address-less slot as a match', () => {
    const service = new SavedPlaceService(new MockSavedPlaceProvider());
    const saved = [savedPlace({ place: null })];
    expect(service.isAlreadySaved(place(), saved)).toBe(false);
  });
});

// ─── Geometry ────────────────────────────────────────────────────────────────

describe('haversineMeters', () => {
  it('measures a known short distance', () => {
    // 0.001° of latitude is ~111 m anywhere on Earth.
    const d = haversineMeters({ latitude: 51.5, longitude: -0.1 }, { latitude: 51.501, longitude: -0.1 });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(118);
  });

  it('is zero for identical points', () => {
    expect(haversineMeters(NEAR, NEAR)).toBe(0);
  });
});
