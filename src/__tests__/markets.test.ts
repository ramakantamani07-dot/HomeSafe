import {
  DEFAULT_EMERGENCY_NUMBER,
  MARKETS,
  emergencyNumberFor,
} from '../config/markets';

describe('emergencyNumberFor', () => {
  it('uses the national number where one is listed', () => {
    expect(emergencyNumberFor('GB')).toBe('999');
    expect(emergencyNumberFor('US')).toBe('911');
    expect(emergencyNumberFor('AU')).toBe('000');
  });

  it('is case-insensitive, since region codes arrive from several sources', () => {
    expect(emergencyNumberFor('gb')).toBe('999');
    expect(emergencyNumberFor('Gb')).toBe('999');
  });

  it('falls back to the GSM standard when the country is unknown or absent', () => {
    // The fallback matters more than the table: it is what someone gets when we
    // cannot establish where they are, which is exactly when it is needed.
    expect(emergencyNumberFor(null)).toBe(DEFAULT_EMERGENCY_NUMBER);
    expect(emergencyNumberFor(undefined)).toBe(DEFAULT_EMERGENCY_NUMBER);
    expect(emergencyNumberFor('')).toBe(DEFAULT_EMERGENCY_NUMBER);
    expect(emergencyNumberFor('ZZ')).toBe(DEFAULT_EMERGENCY_NUMBER);
    expect(DEFAULT_EMERGENCY_NUMBER).toBe('112');
  });

  it('routes India to 112, which is the promise the Terms already make', () => {
    expect(emergencyNumberFor('IN')).toBe('112');
  });

  it('lists North America explicitly, where 112 is not reliably routed', () => {
    // The one case where falling back would be actively wrong rather than
    // merely suboptimal, so it must never be left to the default.
    for (const code of ['US', 'CA']) {
      expect(MARKETS[code]).toBeDefined();
      expect(MARKETS[code].emergencyNumber).not.toBe(DEFAULT_EMERGENCY_NUMBER);
    }
  });

  it('gives every listed market a non-empty number', () => {
    for (const [code, market] of Object.entries(MARKETS)) {
      expect(market.code).toBe(code);
      expect(market.emergencyNumber).toMatch(/^\d{3}$/);
    }
  });
});
