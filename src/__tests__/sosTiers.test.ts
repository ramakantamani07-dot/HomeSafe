import {
  SOS_TIER_1_MS,
  SOS_TIER_2_MS,
  sosHoldProgress,
  sosTierForHold,
} from '../models/SOS';

describe('sosTierForHold', () => {
  it('sends nothing before the first threshold', () => {
    // The whole point of a hold: a pocket press must never raise an alarm.
    expect(sosTierForHold(0)).toBe(0);
    expect(sosTierForHold(SOS_TIER_1_MS - 1)).toBe(0);
  });

  it('alerts guardians from the first threshold', () => {
    expect(sosTierForHold(SOS_TIER_1_MS)).toBe(1);
    expect(sosTierForHold(SOS_TIER_2_MS - 1)).toBe(1);
  });

  it('offers emergency services from the second', () => {
    expect(sosTierForHold(SOS_TIER_2_MS)).toBe(2);
    expect(sosTierForHold(SOS_TIER_2_MS * 5)).toBe(2);
  });
});

describe('sosHoldProgress', () => {
  it('fills across the first tier, then restarts for the second', () => {
    expect(sosHoldProgress(0)).toBe(0);
    expect(sosHoldProgress(SOS_TIER_1_MS / 2)).toBeCloseTo(0.5);
    // Reaching tier 1 is an arrival, not a halfway point — the fill resets.
    expect(sosHoldProgress(SOS_TIER_1_MS)).toBe(0);
    expect(sosHoldProgress((SOS_TIER_1_MS + SOS_TIER_2_MS) / 2)).toBeCloseTo(0.5);
    expect(sosHoldProgress(SOS_TIER_2_MS)).toBe(1);
  });

  it('clamps rather than overflowing on a long hold', () => {
    expect(sosHoldProgress(SOS_TIER_2_MS * 10)).toBe(1);
  });
});
