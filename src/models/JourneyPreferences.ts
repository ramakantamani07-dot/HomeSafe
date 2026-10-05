import { CHECK_IN_INTERVAL_OPTIONS } from './CheckIn';

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
}

/**
 * 10 minutes, matching the value shown in the Option 15 Settings board.
 * Deliberately on by default: a traveller who never opens Settings should
 * still be checked on.
 */
export const DEFAULT_JOURNEY_PREFERENCES: JourneyPreferences = {
  checkInIntervalMinutes: 10,
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
