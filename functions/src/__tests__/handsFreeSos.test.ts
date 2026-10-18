import {
  DEVICE_FIX_MAX_AGE_MS,
  SOS_RATE_LIMIT,
  chooseLocation,
  hashKey,
  keyMatches,
  parseDeviceSosBody,
  rateCheck,
} from '../sos/handsFree';
import { staleFixTime } from '../alerts';

const KEY = 'k'.repeat(43);
const valid = { keyId: 'keyid-123456789012', key: KEY, requestId: '0b5f6c2e-4a1d-4c3b-9f00-6a1b2c3d4e5f' };

describe('SOS key checks', () => {
  it('matches only the exact key, and stores only a hash', () => {
    const h = hashKey(KEY);
    expect(h).not.toContain(KEY);
    expect(keyMatches(h, KEY)).toBe(true);
    expect(keyMatches(h, KEY.slice(0, -1) + 'x')).toBe(false);
  });

  it(`allows ${SOS_RATE_LIMIT.max} SOS per key in ten minutes, then refuses`, () => {
    const now = 1_000_000_000;
    const recent = [now - 1000, now - 2000, now - 3000];
    expect(rateCheck(recent, now).allowed).toBe(false);
    // Older uses fall out of the window.
    expect(rateCheck([now - SOS_RATE_LIMIT.windowMs - 1, now - 1000], now)).toEqual({
      allowed: true,
      kept: [now - 1000],
    });
  });
});

describe('request validation', () => {
  it('accepts a well-formed request, with or without a location', () => {
    expect(parseDeviceSosBody(valid).ok).toBe(true);
    const withFix = parseDeviceSosBody({
      ...valid,
      location: { latitude: 51.47, longitude: -0.07, observedAt: '2026-10-18T21:00:00Z' },
    });
    expect(withFix.ok && withFix.value.location?.latitude).toBe(51.47);
  });

  it('refuses anything malformed rather than guessing', () => {
    expect(parseDeviceSosBody(null).ok).toBe(false);
    expect(parseDeviceSosBody({ ...valid, key: 'short' }).ok).toBe(false);
    expect(parseDeviceSosBody({ ...valid, keyId: 'bad id with spaces!!' }).ok).toBe(false);
    expect(parseDeviceSosBody({ ...valid, test: 'yes' }).ok).toBe(false);
    expect(parseDeviceSosBody({ ...valid, location: { latitude: 91, longitude: 0, observedAt: '2026-10-18T21:00:00Z' } }).ok).toBe(false);
    expect(parseDeviceSosBody({ ...valid, location: { latitude: 51, longitude: 0, observedAt: 'not a date' } }).ok).toBe(false);
  });
});

describe('which location the alert carries', () => {
  const now = new Date('2026-10-18T21:00:00Z');
  const fresh = { latitude: 1, longitude: 1, observedAt: new Date(now.getTime() - 60_000) };
  const old = { latitude: 2, longitude: 2, observedAt: new Date(now.getTime() - DEVICE_FIX_MAX_AGE_MS - 1) };
  const journey = { location: { latitude: 3, longitude: 3 }, at: new Date(now.getTime() - 120_000) };

  it("prefers the phone's own recent fix", () => {
    expect(chooseLocation(fresh, journey, now)).toMatchObject({ source: 'device', location: { latitude: 1 } });
  });

  it("falls back to the journey's last position when the phone's fix is old or missing", () => {
    expect(chooseLocation(old, journey, now)).toMatchObject({ source: 'journey', location: { latitude: 3 } });
    expect(chooseLocation(null, journey, now)).toMatchObject({ source: 'journey' });
  });

  it('uses an old fix rather than none, and says none when there is nothing', () => {
    expect(chooseLocation(old, null, now)).toMatchObject({ source: 'device', location: { latitude: 2 } });
    expect(chooseLocation(null, null, now)).toEqual({ location: null, observedAt: null, source: 'none' });
  });
});

describe('alert wording for an old fix', () => {
  const { Timestamp } = jest.requireActual('firebase-admin/firestore');
  const at = (iso: string) => Timestamp.fromDate(new Date(iso));
  const base = { userId: 'u', journeyId: null, location: { latitude: 1, longitude: 1 }, status: 'ACTIVE' as const };

  it('says when the location was taken if it is well before the SOS', () => {
    const sos = { ...base, triggeredAt: at('2026-10-18T21:00:00Z'), locationObservedAt: at('2026-10-18T20:42:00Z') };
    expect(staleFixTime(sos, '+447700900123')).toBe(' (21:42)'); // UK summer time
  });

  it('says nothing extra for a fresh fix, or an SOS from the app', () => {
    expect(staleFixTime({ ...base, triggeredAt: at('2026-10-18T21:00:00Z'), locationObservedAt: at('2026-10-18T20:58:00Z') }, '')).toBe('');
    expect(staleFixTime({ ...base, triggeredAt: at('2026-10-18T21:00:00Z') }, '')).toBe('');
  });
});
