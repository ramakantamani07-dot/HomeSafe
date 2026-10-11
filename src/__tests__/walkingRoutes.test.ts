import { roadName, toRouteResult } from '../implementations/routing/MapKitWalkingRoutingProvider';

describe('road names from MapKit instructions', () => {
  it('reads the road a step turns onto or continues along', () => {
    expect(roadName('Turn right onto Rye Lane')).toBe('Rye Lane');
    expect(roadName('Turn left onto Peckham High Street.')).toBe('Peckham High Street');
    expect(roadName('Continue on Bellenden Road')).toBe('Bellenden Road');
    expect(roadName('Walk along the Thames Path')).toBe('Thames Path');
  });

  it('names nothing when MapKit gives no road, rather than showing a manoeuvre', () => {
    expect(roadName('Arrive at the destination')).toBeNull();
    expect(roadName('The destination is on your left')).toBeNull();
    expect(roadName('Continue on the path')).toBeNull();
    expect(roadName('')).toBeNull();
  });
});

describe('MapKit route as a RouteResult', () => {
  const at = new Date('2026-10-11T08:00:00Z');
  const native = {
    distanceMeters: 1000,
    durationSeconds: 720,
    coordinates: [[51.47, -0.07], [51.471, -0.071]] as Array<[number, number]>,
    steps: [
      { instructions: 'Turn right onto Rye Lane', distanceMeters: 750, startLatitude: 51.47, startLongitude: -0.07 },
      { instructions: 'Arrive at the destination', distanceMeters: 250, startLatitude: 51.471, startLongitude: -0.071 },
    ],
  };

  it('keeps distance, time and the line to draw', () => {
    const route = toRouteResult(native, at);
    expect(route.distanceMeters).toBe(1000);
    expect(route.durationSeconds).toBe(720);
    expect(route.coordinates).toEqual([
      { latitude: 51.47, longitude: -0.07 },
      { latitude: 51.471, longitude: -0.071 },
    ]);
    expect(route.calculatedAt).toBe(at);
  });

  it('shares the walking time between steps by distance', () => {
    const [first, second] = toRouteResult(native, at).steps;
    expect(first).toMatchObject({ name: 'Rye Lane', distanceMeters: 750, durationSeconds: 540 });
    expect(second).toMatchObject({ name: null, durationSeconds: 180 });
  });

  it('copes with a zero-length route', () => {
    const route = toRouteResult({ ...native, distanceMeters: 0, steps: [native.steps[0]] }, at);
    expect(route.steps[0].durationSeconds).toBe(0);
  });
});
