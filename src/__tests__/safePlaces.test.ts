import {
  SAFE_PLACE_CATEGORIES,
  SAFE_PLACE_CATEGORY_IDS,
  rankSafePlaces,
  type SafePlace,
  type SafePlaceKind,
} from '../models/SafePlace';

function place(kind: SafePlaceKind, distanceMeters: number): SafePlace {
  return {
    id: `${kind}-${distanceMeters}`,
    name: kind,
    kind,
    coordinates: { latitude: 51.5, longitude: -0.13 },
    distanceMeters,
    phoneNumber: null,
  };
}

describe('safe place categories', () => {
  it('excludes everything whose opening hours we cannot know', () => {
    // The point of the whole restriction: Apple publishes no opening hours, so
    // sending someone to a café at 2am would mean guessing at a locked door.
    const kinds = Object.values(SAFE_PLACE_CATEGORIES);
    expect(kinds).not.toContain('cafe');
    expect(kinds).not.toContain('restaurant');
    expect(kinds).not.toContain('store');
  });

  it('includes the places that are staffed around the clock', () => {
    expect(Object.values(SAFE_PLACE_CATEGORIES)).toEqual(
      expect.arrayContaining(['police', 'hospital', 'fire']),
    );
  });

  it('asks MapKit only for categories it maps back to', () => {
    for (const id of SAFE_PLACE_CATEGORY_IDS) {
      expect(SAFE_PLACE_CATEGORIES[id]).toBeDefined();
    }
  });
});

describe('rankSafePlaces', () => {
  it('puts a further police station above a nearer hotel', () => {
    // Distance alone would bury the better destination.
    const ranked = rankSafePlaces([place('hotel', 200), place('police', 600)]);
    expect(ranked.map((p) => p.kind)).toEqual(['police', 'hotel']);
  });

  it('prefers the nearer of two places of the same kind', () => {
    const ranked = rankSafePlaces([place('pharmacy', 900), place('pharmacy', 300)]);
    expect(ranked.map((p) => p.distanceMeters)).toEqual([300, 900]);
  });

  it('does not mutate its input', () => {
    const input = [place('hotel', 100), place('police', 500)];
    rankSafePlaces(input);
    expect(input[0].kind).toBe('hotel');
  });
});
