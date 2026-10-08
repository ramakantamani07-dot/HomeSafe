import type { Coordinates } from '../models/Journey';
import type { LocateReason } from '../models/LocateAudit';

/**
 * Locating a basic-phone member through their network operator.
 *
 * **Named `NetworkLocationProvider`, not `LocationProvider`.** That name is
 * already taken by device GPS, and in a safety system the difference between
 * "where this handset says it is" and "where an operator says this SIM is"
 * must never be ambiguous — they have different accuracy, different consent
 * requirements and different failure modes.
 *
 * **The app adapter never talks to an operator.** It calls our Cloud Function,
 * which holds the credentials and enforces the order the spec requires:
 * guardian check → consent ACTIVE → rate limit → provider call → audit write →
 * transparency SMS. Operator credentials in a client bundle would be
 * indefensible, and a client-side consent check would be advisory at best.
 */
export interface NetworkLocationResult {
  location: Coordinates;
  /** Operator-reported accuracy in metres. Null when it does not say. */
  accuracyMeters: number | null;
  /** When the operator observed this, which may lag the request. */
  observedAt: Date;
}

/**
 * Why a lookup failed, in terms a screen can explain to a guardian.
 *
 * Mirrors `LocateFailure` in `functions/src/networkLocation/locate.ts`, which
 * returns it as the `failure` detail of the callable's error. The operator
 * cases are distinct because the spec's error states are (§5): "her phone is
 * off" and "her network doesn't support this" ask different things of the
 * guardian.
 */
export type NetworkLocationFailure =
  | 'no-consent'
  | 'rate-limited'
  | 'not-guardian'
  | 'operator-unavailable'
  | 'device-unreachable'
  | 'operator-unsupported'
  | 'roaming'
  | 'timeout'
  | 'unknown';

export class NetworkLocationError extends Error {
  constructor(readonly failure: NetworkLocationFailure, message: string) {
    super(message);
    this.name = 'NetworkLocationError';
  }
}

export interface NetworkLocationProvider {
  /**
   * One location fix for a member.
   *
   * Throws `NetworkLocationError` rather than returning null, so a refusal
   * carries its reason — "they haven't agreed yet" and "the network is down"
   * need different things said to the guardian.
   */
  retrieve(memberId: string, reason: LocateReason): Promise<NetworkLocationResult>;

  /**
   * Whether the member is within `radiusMeters` of a point, without returning
   * where they actually are.
   *
   * A genuinely weaker request, and preferred wherever it answers the question:
   * "is she home yet?" does not require knowing she is at the chemist.
   */
  verify(memberId: string, centre: Coordinates, radiusMeters: number): Promise<boolean>;

  createGeofence(memberId: string, centre: Coordinates, radiusMeters: number): Promise<string>;
  deleteGeofence(geofenceId: string): Promise<void>;
}
