/** The daily allowance that keeps "On wayLoc ✓" from becoming a phone-book scan. */
import { LOOKUP_DAILY_LIMIT, lookupDay, withinLookupLimit } from '../family/lookupInvitee';

const now = new Date('2026-10-08T21:00:00Z');

test('allows the first lookup of the day', () => {
  expect(withinLookupLimit(undefined, now)).toBe(true);
});

test('stops at the daily limit', () => {
  expect(withinLookupLimit({ day: lookupDay(now), count: LOOKUP_DAILY_LIMIT - 1 }, now)).toBe(true);
  expect(withinLookupLimit({ day: lookupDay(now), count: LOOKUP_DAILY_LIMIT }, now)).toBe(false);
});

test('resets on a new day', () => {
  expect(withinLookupLimit({ day: '2026-10-07', count: LOOKUP_DAILY_LIMIT }, now)).toBe(true);
});
