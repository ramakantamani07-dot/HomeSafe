import type { Coordinates } from './Journey';

/**
 * A record of one location lookup (network-location spec §5, §9).
 *
 * Written on **every** attempt, including refused ones. An audit that only
 * records successes cannot answer "did anyone try to find me without consent?",
 * which is the question it exists for — and the one a regulator, or the member
 * themselves, is most likely to ask.
 */
export type LocateOutcome =
  | 'success'
  | 'denied-no-consent'
  | 'denied-not-guardian'
  | 'denied-rate-limited'
  | 'provider-error';

/** Why the lookup happened. Manual and automatic deserve different scrutiny. */
export type LocateReason = 'manual' | 'sos' | 'geofence';

export interface LocateAudit {
  id: string;
  memberId: string;
  /** Who asked. Recorded even when refused — especially when refused. */
  requestedBy: string;
  reason: LocateReason;
  outcome: LocateOutcome;
  /** Null unless the lookup succeeded. Never a guess. */
  location: Coordinates | null;
  /** Operator-reported accuracy in metres. Null when unknown. */
  accuracyMeters: number | null;
  at: Date;
}

/**
 * Lookups allowed per member per hour (spec §5, and the "6 finds/hour" shown on
 * the member-detail board).
 *
 * A rate limit here is a privacy control, not a cost control: without one,
 * "consent to be found" quietly becomes "consent to be tracked continuously",
 * which is not what anyone agreed to by texting YES.
 */
export const LOCATE_LIMIT_PER_HOUR = 6;

/** Minimum gap between lookups for one member (spec: max 1/minute). */
export const LOCATE_MIN_INTERVAL_MS = 60_000;

/** Whether a lookup is permitted, given recent ones. Pure, so it is testable. */
export function isRateLimited(recentAttemptsAt: Date[], now: Date): boolean {
  const withinHour = recentAttemptsAt.filter(
    (at) => now.getTime() - at.getTime() < 60 * 60 * 1_000,
  );
  if (withinHour.length >= LOCATE_LIMIT_PER_HOUR) return true;

  const last = withinHour.reduce<Date | null>(
    (latest, at) => (latest === null || at > latest ? at : latest),
    null,
  );
  return last !== null && now.getTime() - last.getTime() < LOCATE_MIN_INTERVAL_MS;
}

/**
 * Outcomes that used up one of the hour's lookups.
 *
 * Mirrors what the server reserves: a lookup that passed the gate counts
 * whether or not the operator then answered, so a phone that is switched off
 * still costs a find — otherwise "Find" on a dead phone could be pressed
 * without limit.
 */
export function countsTowardLimit(outcome: LocateOutcome): boolean {
  return outcome === 'success' || outcome === 'provider-error';
}

/**
 * When Find will next be allowed, or null if it is allowed now.
 *
 * Powers "Find again in N min" (AI13). A prediction — the server decides — but
 * computed from the same rule, so the button and the server agree.
 */
export function nextLookupAllowedAt(recentAttemptsAt: Date[], now: Date): Date | null {
  if (!isRateLimited(recentAttemptsAt, now)) return null;

  const withinHour = recentAttemptsAt
    .filter((at) => now.getTime() - at.getTime() < 60 * 60 * 1_000)
    .sort((a, b) => a.getTime() - b.getTime());

  const last = withinHour[withinHour.length - 1];
  const afterGap = last.getTime() + LOCATE_MIN_INTERVAL_MS;
  // At the hourly cap, the next slot opens when the oldest attempt ages out.
  const afterCap =
    withinHour.length >= LOCATE_LIMIT_PER_HOUR
      ? withinHour[withinHour.length - LOCATE_LIMIT_PER_HOUR].getTime() + 60 * 60 * 1_000
      : 0;
  return new Date(Math.max(afterGap, afterCap));
}
