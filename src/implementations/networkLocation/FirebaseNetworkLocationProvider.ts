import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import type { FirebaseApp } from 'firebase/app';

import type { Coordinates } from '../../models/Journey';
import type { LocateReason } from '../../models/LocateAudit';
import {
  NetworkLocationError,
  type NetworkLocationFailure,
  type NetworkLocationProvider,
  type NetworkLocationResult,
} from '../../providers/NetworkLocationProvider';

interface LocateResponse {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  observedAt: string;
}

const KNOWN_FAILURES: readonly NetworkLocationFailure[] = [
  'no-consent',
  'rate-limited',
  'not-guardian',
  'operator-unavailable',
  'device-unreachable',
  'operator-unsupported',
  'roaming',
  'timeout',
];

/**
 * Network location through our `locateMember` Cloud Function.
 *
 * The function holds the operator credentials and enforces guardian → consent
 * → rate limit; this adapter only asks and translates the answer. The reason is
 * not sent: the server records every app lookup as `manual`, so a client cannot
 * claim an SOS to get past the rate limit (D21).
 */
export class FirebaseNetworkLocationProvider implements NetworkLocationProvider {
  private readonly functions: Functions;

  constructor(app: FirebaseApp) {
    this.functions = getFunctions(app);
  }

  async retrieve(memberId: string, _reason: LocateReason): Promise<NetworkLocationResult> {
    try {
      const call = httpsCallable<{ memberId: string }, LocateResponse>(this.functions, 'locateMember');
      const { data } = await call({ memberId });
      return {
        location: { latitude: data.latitude, longitude: data.longitude },
        accuracyMeters: data.radiusMeters,
        observedAt: new Date(data.observedAt),
      };
    } catch (err) {
      const failure = (err as { details?: { failure?: string } }).details?.failure;
      const known = KNOWN_FAILURES.find((f) => f === failure);
      // No signal reaches here as a network error with no details — which, to
      // the guardian, is "couldn't ask the network", not a refusal.
      throw new NetworkLocationError(known ?? 'unknown', known ?? 'Lookup failed');
    }
  }

  // Safe zones are Phase 6.5. Until then there is no server function behind
  // these, and pretending otherwise would let a screen show a zone that
  // nothing is watching.
  async verify(_memberId: string, _centre: Coordinates, _radiusMeters: number): Promise<boolean> {
    throw new NetworkLocationError('unknown', 'Safe zones are not available yet');
  }

  async createGeofence(_memberId: string, _centre: Coordinates, _radiusMeters: number): Promise<string> {
    throw new NetworkLocationError('unknown', 'Safe zones are not available yet');
  }

  async deleteGeofence(_geofenceId: string): Promise<void> {
    throw new NetworkLocationError('unknown', 'Safe zones are not available yet');
  }
}
