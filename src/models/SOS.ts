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
}
