import type { Coordinates } from './Journey';
import type { SafetyCheckReason } from './AlertRules';

export type SafetyCheckStatus =
  /** Raised, waiting for the traveller to answer. */
  | 'PENDING'
  /** "I'm OK — carry on". */
  | 'CONFIRMED'
  /** "Add 15 min" — acknowledged, thresholds pushed back. */
  | 'EXTENDED'
  /** No reply within the window; guardians were alerted. */
  | 'ESCALATED';

/**
 * One automatic "are you OK?" — screen 08.
 *
 * Deliberately a separate record from `CheckIn` (the interval-timer feature).
 * A missed interval check-in *ends* the journey with status MISSED_CHECKIN; a
 * missed safety check must NOT, because the whole point of escalating is that
 * guardians get the traveller's **live** location — which requires the
 * journey, and therefore tracking, to keep running.
 */
export interface SafetyCheck {
  id: string;
  journeyId: string;
  reason: SafetyCheckReason;
  status: SafetyCheckStatus;
  raisedAt: Date;
  /** When the user answered. Null while pending or if it escalated. */
  respondedAt: Date | null;
  /**
   * When guardians must be alerted if this is still unanswered.
   *
   * Written at creation and never changed. This is what makes escalation
   * survive the client dying: a Cloud Function sweeps for PENDING checks past
   * their deadline, so the alert goes out even if the app was force-quit, ran
   * out of battery, or lost its JS runtime entirely — which are precisely the
   * circumstances in which a guardian most needs to hear from us.
   */
  escalateAt: Date;
  /** When guardians were alerted. Null unless status is ESCALATED. */
  escalatedAt: Date | null;
  /** Where the traveller was when it was raised — sent to guardians on escalation. */
  location: Coordinates | null;
  /** Battery percentage at escalation, so guardians know how long they have. */
  batteryPercent: number | null;
  /** Minutes added by "Add 15 min". Null otherwise. */
  extendedByMinutes: number | null;
}

/** How long "Add 15 min" pushes the thresholds back. */
export const SAFETY_CHECK_EXTENSION_MINUTES = 15;

/**
 * Minimum gap between safety checks on one journey.
 *
 * Without this, a traveller genuinely stopped for lunch would be asked every
 * tick of the detector. Being nagged is how people learn to dismiss safety
 * prompts without reading them, which is the failure mode this feature can
 * least afford.
 */
export const SAFETY_CHECK_COOLDOWN_MINUTES = 10;

/** Distance under which the traveller counts as "not moving". */
export const STOPPED_RADIUS_METERS = 60;

/** Positions older than this are dropped; nothing looks further back. */
export const SAMPLE_RETENTION_MS = 45 * 60_000;

/** Notification identifier, so the prompt can be dismissed once answered. */
export const SAFETY_CHECK_NOTIFICATION_ID = 'wayloc.safety-check';

/**
 * Notification category carrying the "I'm safe" / "SOS" actions.
 *
 * Registered once at startup (see app/_layout.tsx). Without it the prompt is a
 * plain banner, and the traveller has to unlock, open the app and find the
 * modal — during the two-minute window before guardians are alerted, with the
 * phone most likely in a pocket. The actions are the whole point.
 */
export const SAFETY_CHECK_NOTIFICATION_CATEGORY = 'wayloc.safety-check-prompt';

/** Action identifiers on that category. */
export const SAFETY_CHECK_ACTION_IM_OK = 'SAFETY_CHECK_IM_OK';
export const SAFETY_CHECK_ACTION_SOS = 'SAFETY_CHECK_SOS';
