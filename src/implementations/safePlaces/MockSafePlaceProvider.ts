import type { Coordinates } from '../../models/Journey';
import type { SafePlace } from '../../models/SafePlace';
import { haversineMeters } from '../../models/Place';
import { rankSafePlaces } from '../../models/SafePlace';
import type { SafePlaceProvider } from '../../providers/SafePlaceProvider';

/**
 * Fixtures around the caller, so the flow is exercisable with no device, no
 * network and no MapKit — in dev, in CI, and on Android until a keyless source
 * exists there.
 *
 * Offsets are in degrees; roughly 110m per 0.001° of latitude at UK latitudes,
 * which is close enough for a fixture and avoids pretending to a precision the
 * mock does not have.
 */
const FIXTURES: Array<{ name: string; kind: SafePlace['kind']; dLat: number; dLng: number; phone: string | null }> = [
  { name: 'Charing Cross Police Station', kind: 'police', dLat: 0.004, dLng: 0.002, phone: '+442071010101' },
  { name: "St Thomas' Hospital", kind: 'hospital', dLat: -0.006, dLng: 0.004, phone: '+442071887188' },
  { name: 'Soho Fire Station', kind: 'fire', dLat: 0.003, dLng: -0.005, phone: null },
  { name: 'Boots Pharmacy', kind: 'pharmacy', dLat: 0.001, dLng: 0.001, phone: '+442074941671' },
  { name: 'Shell Strand', kind: 'fuel', dLat: -0.002, dLng: 0.006, phone: null },
];

export class MockSafePlaceProvider implements SafePlaceProvider {
  async findNearby(near: Coordinates): Promise<SafePlace[]> {
    const places = FIXTURES.map((f, index) => {
      const coordinates = {
        latitude: near.latitude + f.dLat,
        longitude: near.longitude + f.dLng,
      };
      return {
        id: `mock-safe-place-${index}`,
        name: f.name,
        kind: f.kind,
        coordinates,
        distanceMeters: Math.round(haversineMeters(near, coordinates)),
        phoneNumber: f.phone,
      };
    });

    return rankSafePlaces(places);
  }
}
