import type { CheckIn, CheckInStatus } from '../models/CheckIn';

export interface CheckInUpdates {
  status: CheckInStatus;
  respondedAt: Date | null;
  extendedByMinutes: number | null;
}

export interface CheckInProvider {
  /** Creates a PENDING check-in record when the timer fires. */
  createCheckIn(userId: string, journeyId: string, scheduledAt: Date): Promise<CheckIn>;
  /**
   * Creates a PENDING check-in using a caller-supplied document ID.
   * Used during offline sync replay so the client-generated ID (stored in the
   * queue) becomes the Firestore document ID, keeping updateCheckIn consistent.
   */
  createCheckInWithId(
    userId: string,
    journeyId: string,
    checkInId: string,
    scheduledAt: Date,
  ): Promise<CheckIn>;
  /** Updates an existing check-in record (CONFIRMED / EXTENDED / MISSED). */
  updateCheckIn(
    userId: string,
    journeyId: string,
    checkInId: string,
    updates: CheckInUpdates,
  ): Promise<CheckIn>;
  /** Returns the most recently created check-in for the journey, or null. */
  getLatestCheckIn(userId: string, journeyId: string): Promise<CheckIn | null>;
}
