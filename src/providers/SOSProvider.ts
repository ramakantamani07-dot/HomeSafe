import type { SOSEvent } from '../models/SOS';
import type { Coordinates } from '../models/Journey';

export interface SOSProvider {
  /** Creates a new active SOS event. */
  createSOS(
    userId: string,
    journeyId: string | null,
    location: Coordinates | null,
  ): Promise<SOSEvent>;
  /**
   * Creates an SOS event using a caller-supplied document ID.
   * Used during offline sync replay so the client-generated ID (stored in the
   * queue) becomes the Firestore document ID, keeping resolveSOS consistent.
   */
  createSOSWithId(
    userId: string,
    sosId: string,
    journeyId: string | null,
    location: Coordinates | null,
  ): Promise<SOSEvent>;
  /** Marks an existing SOS event as RESOLVED. */
  resolveSOS(userId: string, sosId: string): Promise<SOSEvent>;
  /**
   * Flags an SOS event as a duress ("fake") resolve. Deliberately does NOT
   * change `status` or `resolvedAt` — the alert stays ACTIVE and tracking
   * keeps running; only a `duressTriggered` marker is written.
   */
  markDuress(userId: string, sosId: string): Promise<SOSEvent>;
  /** Returns the current active SOS for the user, or null if none. */
  getActiveSOS(userId: string): Promise<SOSEvent | null>;
}
