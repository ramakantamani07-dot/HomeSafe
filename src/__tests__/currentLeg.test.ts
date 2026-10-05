import { currentLeg, type RouteResult, type RouteStep } from '../models/RouteResult';

function step(name: string | null, latitude: number, longitude: number): RouteStep {
  return { name, distanceMeters: 100, durationSeconds: 60, start: { latitude, longitude } };
}

function route(steps: RouteStep[]): RouteResult {
  return {
    providerRouteId: null,
    coordinates: [],
    distanceMeters: 500,
    durationSeconds: 300,
    steps,
    calculatedAt: new Date(),
  };
}

describe('currentLeg', () => {
  it('picks the named step nearest the traveller', () => {
    const r = route([
      step('Orange Street', 51.5, -0.13),
      step('Whitehall', 51.505, -0.126),
      step('The Mall', 51.52, -0.14),
    ]);

    expect(currentLeg(r, { latitude: 51.5051, longitude: -0.1261 })?.name).toBe('Whitehall');
    expect(currentLeg(r, { latitude: 51.5001, longitude: -0.1301 })?.name).toBe('Orange Street');
  });

  it('skips unnamed steps rather than rendering a blank banner', () => {
    // The unnamed path is nearest, but naming nothing is not useful to show.
    const r = route([step(null, 51.5, -0.13), step('Whitehall', 51.6, -0.2)]);

    expect(currentLeg(r, { latitude: 51.5, longitude: -0.13 })?.name).toBe('Whitehall');
  });

  it('returns null when there is nothing to say', () => {
    expect(currentLeg(null, { latitude: 51.5, longitude: -0.13 })).toBeNull();
    expect(currentLeg(route([step('Whitehall', 51.5, -0.13)]), null)).toBeNull();
    expect(currentLeg(route([]), { latitude: 51.5, longitude: -0.13 })).toBeNull();
    expect(currentLeg(route([step(null, 51.5, -0.13)]), { latitude: 51.5, longitude: -0.13 })).toBeNull();
  });
});
