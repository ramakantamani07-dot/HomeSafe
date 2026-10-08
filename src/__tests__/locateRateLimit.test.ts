import { LOCATE_LIMIT_PER_HOUR, isRateLimited } from '../models/LocateAudit';

const now = new Date('2026-10-06T12:00:00Z');
const minutesAgo = (n: number) => new Date(now.getTime() - n * 60_000);

describe('isRateLimited', () => {
  it('allows the first lookup', () => {
    expect(isRateLimited([], now)).toBe(false);
  });

  it('enforces the one-per-minute gap', () => {
    // Without this, holding the Find button would become continuous tracking.
    expect(isRateLimited([minutesAgo(0.5)], now)).toBe(true);
    expect(isRateLimited([minutesAgo(1.5)], now)).toBe(false);
  });

  it('enforces the hourly cap', () => {
    const six = Array.from({ length: LOCATE_LIMIT_PER_HOUR }, (_, i) => minutesAgo(i * 5 + 5));
    expect(isRateLimited(six, now)).toBe(true);
  });

  it('forgets attempts older than an hour', () => {
    const old = Array.from({ length: LOCATE_LIMIT_PER_HOUR }, (_, i) => minutesAgo(61 + i));
    expect(isRateLimited(old, now)).toBe(false);
  });

  it('counts only the last hour when old and recent are mixed', () => {
    const attempts = [
      ...Array.from({ length: 5 }, (_, i) => minutesAgo(90 + i)),
      minutesAgo(30),
      minutesAgo(20),
    ];
    expect(isRateLimited(attempts, now)).toBe(false);
  });
});
