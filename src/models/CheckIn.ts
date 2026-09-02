export type CheckInStatus = 'PENDING' | 'CONFIRMED' | 'EXTENDED' | 'MISSED';

export interface CheckIn {
  id: string;
  journeyId: string;
  /** When the check-in was originally due. */
  scheduledAt: Date;
  /** When the user responded. Null if missed. */
  respondedAt: Date | null;
  status: CheckInStatus;
  /** Non-null only when status is EXTENDED. */
  extendedByMinutes: number | null;
  createdAt: Date;
}

/** Grace period after the check-in timer fires before the journey is marked MISSED. */
export const GRACE_PERIOD_MINUTES = 5;

/** Preset extension options shown in the "Are you safe?" prompt. */
export const EXTEND_OPTIONS_MINUTES = [15, 30, 60] as const;
export type ExtendMinutes = (typeof EXTEND_OPTIONS_MINUTES)[number];

/** Preset check-in interval options shown on the Start Journey screen. */
export const CHECK_IN_INTERVAL_OPTIONS = [15, 30, 60] as const;
export type CheckInIntervalMinutes = (typeof CHECK_IN_INTERVAL_OPTIONS)[number];
