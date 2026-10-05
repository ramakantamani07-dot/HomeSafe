/**
 * A public, unauthenticated read-only link to a journey's status — for a
 * guardian who doesn't have (and isn't required to install) wayLoc.
 *
 * Deliberately excludes live GPS coordinates: this is a public link, not a
 * logged-in Family connection with its own granular per-field permissions
 * (see models/Family.ts). Status + destination + ETA delivers most of the
 * "someone can follow along" value without extending that permission model
 * to an anonymous audience — a deliberate v1 scope limit, not an oversight.
 *
 * No explicit revoke/expiry field: a share is valid for exactly as long as
 * its linked journey's status is 'ACTIVE' — the read path checks the journey
 * itself, not this document, so there's nothing to keep in sync.
 */
export interface JourneyShare {
  id: string;
  userId: string;
  journeyId: string;
  /** Captured at share-creation time — the user's profile name lives in
   * device SecureStore, not Firestore, so it isn't otherwise readable
   * server-side. */
  displayName: string;
  createdAt: Date;
}

/** What the public tracking page actually receives — never the raw Journey. */
export interface SharedJourneyView {
  found: boolean;
  active: boolean;
  displayName: string | null;
  destinationLabel: string | null;
  eta: string | null; // ISO 8601, or null if not yet calculated
  status: 'TRAVELLING' | 'ARRIVED' | 'ENDED' | null;
}
