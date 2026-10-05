import type { Coordinates } from './Journey';

export type SOSStatus = 'ACTIVE' | 'RESOLVED';

export interface SOSEvent {
  id: string;
  userId: string;
  journeyId: string | null;
  /** Latest known location at the time SOS was triggered. */
  location: Coordinates | null;
  status: SOSStatus;
  triggeredAt: Date;
  resolvedAt: Date | null;
  createdAt: Date;
  /**
   * Set when the user "resolved" the alert with their duress code instead of
   * a real resolve. Status stays ACTIVE and tracking keeps running — this
   * flag exists only so the record itself shows what actually happened.
   */
  duressTriggered: boolean;
}
