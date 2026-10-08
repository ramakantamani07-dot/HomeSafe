import type { ConsentStatus } from '../../models/Consent';
import { allowsLocationLookup } from '../../models/Consent';
import type { Coordinates } from '../../models/Journey';
import { isRateLimited, type LocateOutcome, type LocateReason } from '../../models/LocateAudit';
import type {
  NetworkLocationProvider,
  NetworkLocationResult,
} from '../../providers/NetworkLocationProvider';
import { NetworkLocationError } from '../../providers/NetworkLocationProvider';

/**
 * Network location without an operator, so the whole flow is exercisable before
 * any commercial agreement exists (decision G3 is still open).
 *
 * Accuracy is deliberately poor — hundreds of metres, not tens. Network
 * location genuinely is that coarse, and a mock that returned GPS-grade
 * precision would let us build screens that quietly promise more than the real
 * thing can deliver.
 */
const MOCK_ACCURACY_METERS = 650;

/**
 * Where the mock checks consent and the rate limit, and records each lookup —
 * the role Firestore and `locateMember` play for the real adapter. Optional,
 * so this provider still works standalone in tests.
 */
export interface MockLocateLedger {
  consentOf(memberId: string): ConsentStatus | null;
  attemptsOf(memberId: string): Date[];
  record(
    memberId: string,
    reason: LocateReason,
    outcome: LocateOutcome,
    fix: { latitude: number; longitude: number; accuracyMeters: number } | null,
  ): void;
}

export class MockNetworkLocationProvider implements NetworkLocationProvider {
  private geofences = new Map<string, { memberId: string; centre: Coordinates; radiusMeters: number }>();
  private nextGeofenceId = 1;
  /** Members this mock should refuse, so refusal paths are testable too. */
  private withoutConsent = new Set<string>();

  constructor(private readonly ledger: MockLocateLedger | null = null) {}

  /** Test seam: makes `memberId` behave as if consent were never granted. */
  denyConsentFor(memberId: string): void {
    this.withoutConsent.add(memberId);
  }

  async retrieve(memberId: string, reason: LocateReason): Promise<NetworkLocationResult> {
    if (this.withoutConsent.has(memberId)) {
      throw new NetworkLocationError('no-consent', 'This person has not agreed to be found.');
    }
    // Same order as the server: consent, then rate limit — and refusals are
    // recorded too, as the real audit records them.
    if (this.ledger) {
      const status = this.ledger.consentOf(memberId);
      if (!status || !allowsLocationLookup(status)) {
        this.ledger.record(memberId, reason, 'denied-no-consent', null);
        throw new NetworkLocationError('no-consent', 'This person has not agreed to be found.');
      }
      if (reason !== 'sos' && isRateLimited(this.ledger.attemptsOf(memberId), new Date())) {
        this.ledger.record(memberId, reason, 'denied-rate-limited', null);
        throw new NetworkLocationError('rate-limited', 'Too many finds this hour.');
      }
    }

    // A stable pseudo-location per member, so repeated lookups do not jitter
    // around the map and the UI can be judged on something steady.
    const seed = [...memberId].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const location = {
      latitude: 51.5 + ((seed % 100) - 50) / 2_000,
      longitude: -0.12 + ((seed % 73) - 36) / 2_000,
    };
    this.ledger?.record(memberId, reason, 'success', { ...location, accuracyMeters: MOCK_ACCURACY_METERS });
    return { location, accuracyMeters: MOCK_ACCURACY_METERS, observedAt: new Date() };
  }

  async verify(memberId: string, centre: Coordinates, radiusMeters: number): Promise<boolean> {
    const { location } = await this.retrieve(memberId, 'manual');
    const dLat = (location.latitude - centre.latitude) * 111_000;
    const dLon = (location.longitude - centre.longitude) * 111_000;
    return Math.sqrt(dLat * dLat + dLon * dLon) <= radiusMeters;
  }

  async createGeofence(
    memberId: string,
    centre: Coordinates,
    radiusMeters: number,
  ): Promise<string> {
    const id = `mock-geofence-${this.nextGeofenceId++}`;
    this.geofences.set(id, { memberId, centre, radiusMeters });
    return id;
  }

  async deleteGeofence(geofenceId: string): Promise<void> {
    this.geofences.delete(geofenceId);
  }
}
