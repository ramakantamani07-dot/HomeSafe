/**
 * Journey preferences tests.
 *
 * These exist because of a specific regression: when the destination picker
 * was rewritten, nothing passed `checkInIntervalMinutes` any more, so it was
 * always null, so CheckInContext's guard bailed — and the entire interval
 * check-in subsystem became unreachable without a single test failing. The
 * scheduled Cloud Function kept running every two minutes looking for a state
 * the app could no longer produce.
 *
 * The assertions below are the cheap guard against that happening again.
 */

import {
  CHECK_IN_INTERVAL_CHOICES,
  DEFAULT_JOURNEY_PREFERENCES,
  isValidCheckInInterval,
} from '../models/JourneyPreferences';

describe('journey preferences defaults', () => {
  it('checks on the traveller by default', () => {
    // The regression guard. A null default means a user who never opens
    // Settings gets no interval check-ins at all, and the subsystem goes
    // quietly dead again.
    expect(DEFAULT_JOURNEY_PREFERENCES.checkInIntervalMinutes).not.toBeNull();
  });

  it('defaults to the 10 minutes shown in the Settings design', () => {
    expect(DEFAULT_JOURNEY_PREFERENCES.checkInIntervalMinutes).toBe(10);
  });

  it('offers the default as a selectable choice', () => {
    // If the default isn't in the list, Settings renders nothing as selected
    // and the user cannot get back to it after changing it.
    const values = CHECK_IN_INTERVAL_CHOICES.map((c) => c.value);
    expect(values).toContain(DEFAULT_JOURNEY_PREFERENCES.checkInIntervalMinutes);
  });

  it('offers an explicit off switch', () => {
    expect(CHECK_IN_INTERVAL_CHOICES.map((c) => c.value)).toContain(null);
  });

  it('has no duplicate choices', () => {
    const values = CHECK_IN_INTERVAL_CHOICES.map((c) => c.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('isValidCheckInInterval', () => {
  it('accepts every offered choice, including off', () => {
    for (const choice of CHECK_IN_INTERVAL_CHOICES) {
      expect(isValidCheckInInterval(choice.value)).toBe(true);
    }
  });

  it('rejects a value no longer offered', () => {
    // A build that once offered 45 min would have persisted it. Restoring it
    // would show "Off" in Settings while check-ins still fired — the user
    // would have no way to see or change what was actually happening.
    expect(isValidCheckInInterval(45)).toBe(false);
    expect(isValidCheckInInterval(0)).toBe(false);
    expect(isValidCheckInInterval(-10)).toBe(false);
  });
});
