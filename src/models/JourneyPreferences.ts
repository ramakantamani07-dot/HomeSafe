import { CHECK_IN_INTERVAL_OPTIONS } from './CheckIn';
import type { AlertRules } from './AlertRules';
import { DEFAULT_ALERT_RULES } from './AlertRules';

/**
 * Journey defaults the user sets once in Settings, applied to every journey
 * they start — Option 15's "Journeys" group (`AI9`).
 *
 * Lives apart from `AlertRules` on purpose: alert rules are a *property of a
 * journey*, captured at start and immutable thereafter so a journey's
 * behaviour can always be explained from its own record. These are the
 * *defaults* those rules are seeded from, and changing them must never alter
 * a journey already underway.
 */
export interface JourneyPreferences {
  /**
   * Minutes between periodic "are you safe?" check-ins — Settings' "Check on
   * me if late". Null disables them, leaving only the automatic safety checks
   * (late / stopped / off-route), which are always on.
   */
  checkInIntervalMinutes: number | null;
  /**
   * Defaults for "if something seems off" — how late, and how long stopped,
   * before a safety check is raised.
   *
   * These moved here from the Review screen to satisfy §10's acceptance
   * criterion: *"All setup lives in Settings; nothing on the journey screens
   * asks the user to configure anything."* Review now shows what will happen
   * without offering to change it, which is the difference between informing
   * someone and asking them to make a decision at the moment they are trying
   * to leave.
   */
  alertRules: AlertRules;
}

/**
 * 10 minutes, matching the value shown in the Option 15 Settings board.
 * Deliberately on by default: a traveller who never opens Settings should
 * still be checked on.
 */
export const DEFAULT_JOURNEY_PREFERENCES: JourneyPreferences = {
  checkInIntervalMinutes: 10,
  alertRules: DEFAULT_ALERT_RULES,
};

/** Options offered by the "Check on me if late" control, plus "off". */
export const CHECK_IN_INTERVAL_CHOICES: Array<{ label: string; value: number | null }> = [
  { label: 'Off', value: null },
  { label: '10 min', value: 10 },
  ...CHECK_IN_INTERVAL_OPTIONS.map((m) => ({ label: `${m} min`, value: m as number | null })),
];

/** Guards against a stored value that is no longer an offered option. */
export function isValidCheckInInterval(value: number | null): boolean {
  return value === null || CHECK_IN_INTERVAL_CHOICES.some((c) => c.value === value);
}

/** Options for "Tell someone if I'm late by". */
export const LATE_MINUTES_CHOICES: Array<{ label: string; value: number }> = [
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '20 min', value: 20 },
  { label: '30 min', value: 30 },
];

/** Options for "…or if I stop for". */
export const STOPPED_MINUTES_CHOICES: Array<{ label: string; value: number }> = [
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '15 min', value: 15 },
];

/**
 * Guards stored rules against values no longer offered.
 *
 * Falls back per field rather than discarding the whole object: a stale
 * "stopped" value should not also reset a "late" value the user did choose.
 */
export function sanitiseAlertRules(stored: Partial<AlertRules> | undefined): AlertRules {
  const valid = (choices: Array<{ value: number }>, value: number | undefined, fallback: number) =>
    value !== undefined && choices.some((c) => c.value === value) ? value : fallback;

  return {
    ...DEFAULT_ALERT_RULES,
    lateMinutes: valid(LATE_MINUTES_CHOICES, stored?.lateMinutes, DEFAULT_ALERT_RULES.lateMinutes),
    stoppedMinutes: valid(
      STOPPED_MINUTES_CHOICES,
      stored?.stoppedMinutes,
      DEFAULT_ALERT_RULES.stoppedMinutes,
    ),
  };
}
