import { SOS_HOLD_CHOICES_MS, SOS_TIER_1_MS } from './SOS';

/**
 * Safety-tool settings — Option 15's "Safety tools" group (`AI11`).
 *
 * Separate from `JourneyPreferences` because these apply whether or not a
 * journey is running: SOS and the Medical ID are reachable from Home, and a
 * setting that only took effect mid-journey would be a trap.
 */
export interface SafetyPreferences {
  /**
   * How long the SOS control must be held before guardians are alerted.
   * The second tier is always double this — see `tier2For`.
   */
  sosHoldMs: number;
  /**
   * Shown to whoever responds to an emergency: allergies, conditions,
   * medication. Free text because the useful thing to say varies, and a form
   * of fixed fields would quietly exclude whatever someone actually needs
   * said. Empty when not set — never a placeholder that reads as real.
   */
  medicalNotes: string;
}

export const DEFAULT_SAFETY_PREFERENCES: SafetyPreferences = {
  sosHoldMs: SOS_TIER_1_MS,
  medicalNotes: '',
};

/** Longest Medical ID we will store. Long enough to matter, short enough to read under pressure. */
export const MEDICAL_NOTES_MAX_LENGTH = 500;

/** The choices offered for "SOS hold time", labelled for display. */
export const SOS_HOLD_CHOICES: Array<{ label: string; value: number }> =
  SOS_HOLD_CHOICES_MS.map((ms) => ({ label: `${ms / 1_000} seconds`, value: ms }));

/**
 * Guards a stored value that is no longer offered.
 *
 * Matters more here than for most preferences: a corrupted or stale hold time
 * could make SOS unreachable, so anything unrecognised falls back to the
 * default rather than being trusted.
 */
export function isValidSosHold(value: number): boolean {
  return SOS_HOLD_CHOICES_MS.includes(value as (typeof SOS_HOLD_CHOICES_MS)[number]);
}

/** Normalises anything loaded from storage into something safe to use. */
export function sanitiseSafetyPreferences(
  stored: Partial<SafetyPreferences> | null | undefined,
): SafetyPreferences {
  return {
    sosHoldMs:
      stored?.sosHoldMs !== undefined && isValidSosHold(stored.sosHoldMs)
        ? stored.sosHoldMs
        : DEFAULT_SAFETY_PREFERENCES.sosHoldMs,
    medicalNotes: (stored?.medicalNotes ?? '').slice(0, MEDICAL_NOTES_MAX_LENGTH),
  };
}
