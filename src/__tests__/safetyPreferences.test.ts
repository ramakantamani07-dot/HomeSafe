import { SOS_TIER_1_MS, sosTierForHold, tier2For } from '../models/SOS';
import {
  DEFAULT_SAFETY_PREFERENCES,
  MEDICAL_NOTES_MAX_LENGTH,
  isValidSosHold,
  sanitiseSafetyPreferences,
} from '../models/SafetyPreferences';

describe('SOS hold preference', () => {
  it('accepts only the offered durations', () => {
    expect(isValidSosHold(3_000)).toBe(true);
    expect(isValidSosHold(4_000)).toBe(false);
    expect(isValidSosHold(0)).toBe(false);
  });

  it('falls back to the default rather than trusting a stale stored value', () => {
    // Matters more than for most settings: a corrupt hold time could make SOS
    // unreachable, so anything unrecognised must not be honoured.
    expect(sanitiseSafetyPreferences({ sosHoldMs: 90_000 }).sosHoldMs).toBe(
      DEFAULT_SAFETY_PREFERENCES.sosHoldMs,
    );
    expect(sanitiseSafetyPreferences(null).sosHoldMs).toBe(SOS_TIER_1_MS);
  });

  it('truncates medical notes rather than rejecting them', () => {
    const long = 'a'.repeat(MEDICAL_NOTES_MAX_LENGTH + 50);
    expect(sanitiseSafetyPreferences({ medicalNotes: long }).medicalNotes).toHaveLength(
      MEDICAL_NOTES_MAX_LENGTH,
    );
  });

  it('defaults medical notes to empty, never to placeholder text', () => {
    // A placeholder that reads as real medical information would be dangerous.
    expect(sanitiseSafetyPreferences(null).medicalNotes).toBe('');
  });
});

describe('a configured hold time drives both tiers', () => {
  it('keeps tier 2 at double whatever tier 1 is', () => {
    for (const tier1 of [2_000, 3_000, 5_000]) {
      expect(tier2For(tier1)).toBe(tier1 * 2);
      expect(sosTierForHold(tier1 - 1, tier1)).toBe(0);
      expect(sosTierForHold(tier1, tier1)).toBe(1);
      expect(sosTierForHold(tier1 * 2, tier1)).toBe(2);
    }
  });

  it('a longer hold genuinely delays tier 1', () => {
    // Someone who picks 5s to avoid pocket triggers must not still fire at 3s.
    expect(sosTierForHold(3_000, 5_000)).toBe(0);
  });
});
