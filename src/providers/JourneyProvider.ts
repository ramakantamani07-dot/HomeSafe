import type { Journey, JourneyStatus, StartJourneyInput } from '../models/Journey';
import type { LocationUpdate } from '../models/LocationUpdate';

/** Statuses that terminate an active journey. */
export type TerminalJourneyStatus = 'COMPLETED' | 'CANCELLED' | 'MISSED_CHECKIN';

/** Journey statuses that represent a finished (non-active) journey. */
export const TERMINAL_JOURNEY_STATUSES: JourneyStatus[] = [
  'COMPLETED',
  'CANCELLED',
  'MISSED_CHECKIN',
  'SOS_TRIGGERED',
];

export interface JourneyProvider {
  createJourney(userId: string, input: StartJourneyInput): Promise<Journey>;
  getActiveJourney(userId: string): Promise<Journey | null>;
  updateJourneyStatus(
    userId: string,
    journeyId: string,
    status: TerminalJourneyStatus,
  ): Promise<Journey>;
  /**
   * Persists a tracking update.
   * - Sets currentLocation on the journey document (latest position).
   * - Appends the update to the locationUpdates sub-collection (history).
   */
  saveLocationUpdate(
    userId: string,
    journeyId: string,
    update: LocationUpdate,
  ): Promise<void>;
  /**
   * Updates the nextCheckInAt timestamp on the journey document.
   * Pass null to clear it (e.g. after a missed check-in or journey end).
   */
  updateNextCheckInAt(
    userId: string,
    journeyId: string,
    nextCheckInAt: Date | null,
  ): Promise<void>;
  /**
   * Sets journey status to SOS_TRIGGERED without setting endedAt.
   * Called by SOSService when an SOS is triggered mid-journey.
   */
  setJourneySOSStatus(userId: string, journeyId: string): Promise<void>;
  /**
   * Persists the calculated route summary to the journey document.
   * Called by RoutingContext after the first successful route calculation.
   * Best-effort — failures are silently swallowed by the caller.
   */
  saveRouteData(
    userId: string,
    journeyId: string,
    distanceMeters: number,
    durationSeconds: number,
    initialEta: Date,
  ): Promise<void>;

  /**
   * Returns all completed/cancelled/missed journeys for the user, newest first.
   * Used for user-controlled journey history deletion.
   */
  listJourneyHistory(userId: string): Promise<Journey[]>;

  /**
   * Deletes all locationUpdates documents for a journey and clears the
   * currentLocation field on the journey document.
   * The journey document itself is NOT deleted — only the detailed trail.
   */
  deleteJourneyLocationHistory(userId: string, journeyId: string): Promise<void>;

  /**
   * Creates a public share link for a journey and returns its token.
   * See models/JourneyShare.ts for exactly what this does and doesn't expose.
   * Each call creates a new, independent token — there's no single "the"
   * share link per journey, and no revoke: validity is tied entirely to the
   * linked journey's own status (checked server-side on read), not this
   * document's existence.
   */
  createShareLink(userId: string, journeyId: string, displayName: string): Promise<string>;
}
