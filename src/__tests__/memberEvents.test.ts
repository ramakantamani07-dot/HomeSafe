import { describeMemberEvent, type MemberEvent } from '../models/MemberEvent';
import { MockBasicPhoneMemberProvider } from '../implementations/networkLocation/MockBasicPhoneMemberProvider';

const base: MemberEvent = {
  id: 'e',
  memberId: 'm',
  kind: 'sos',
  source: 'sms',
  label: null,
  at: new Date(),
  location: null,
  accuracyMeters: null,
  failure: 'device-unreachable',
};

test('an SOS says how it came and whether a location was found', () => {
  expect(describeMemberEvent(base, 'Sam')).toEqual({ title: 'SOS from Sam', detail: 'By text · Location unavailable' });
  expect(describeMemberEvent({ ...base, source: 'call', location: { latitude: 1, longitude: 1 }, failure: null }, 'Sam').detail).toBe(
    'By missed call · Approximate area found',
  );
  expect(describeMemberEvent({ ...base, failure: 'not-requested' }, 'Sam').detail).toMatch(/stop sharing/);
});

test('a check-in names the place, and OK reads as a person would say it', () => {
  expect(describeMemberEvent({ ...base, kind: 'checkin', label: 'Home', failure: null }, 'Sam').title).toBe('Sam checked in: Home');
  expect(describeMemberEvent({ ...base, kind: 'checkin', label: 'OK', failure: null }, 'Sam').title).toBe("Sam said they're OK");
});

test('mock events arrive newest first, per member', () => {
  const provider = new MockBasicPhoneMemberProvider(null);
  const seen: MemberEvent[][] = [];
  provider.subscribeEvents('me', 'm1', (e) => seen.push(e));
  provider.simulateMessage('m1', 'checkin', 'Home');
  provider.simulateMessage('m2', 'sos');
  provider.simulateMessage('m1', 'sos');
  expect(seen[seen.length - 1].map((e) => e.kind)).toEqual(['sos', 'checkin']);
});
