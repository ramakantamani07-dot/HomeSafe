import { ZONES_PER_MEMBER, canAddZone, describeZone, type SafeZone } from '../models/SafeZone';
import { MockBasicPhoneMemberProvider } from '../implementations/networkLocation/MockBasicPhoneMemberProvider';

const now = new Date('2026-10-08T09:00:00Z');
const zone = (over: Partial<SafeZone>): SafeZone => ({
  id: 'z',
  memberId: 'm',
  name: 'School',
  centre: { latitude: 51.5, longitude: -0.1 },
  radiusMeters: 500,
  state: 'unknown',
  lastCheckedAt: null,
  lastEventAt: null,
  createdAt: now,
  ...over,
});

describe('describeZone', () => {
  it('says only what the network last answered, and when', () => {
    expect(describeZone(zone({}), now)).toBe('Waiting for the first check');
    expect(describeZone(zone({ state: 'inside', lastCheckedAt: new Date(now.getTime() - 10 * 60_000) }), now)).toBe(
      'Inside · checked 10 min ago',
    );
    expect(describeZone(zone({ state: 'outside', lastCheckedAt: now }), now)).toBe('Not inside · checked just now');
  });

  it('never claims more than "inside the circle"', () => {
    const text = describeZone(zone({ state: 'inside', lastCheckedAt: now }), now);
    expect(text).not.toMatch(/safe|arrived|at school/i);
  });
});

describe('zones per member', () => {
  it(`stops at ${ZONES_PER_MEMBER}`, () => {
    expect(canAddZone(ZONES_PER_MEMBER - 1)).toBe(true);
    expect(canAddZone(ZONES_PER_MEMBER)).toBe(false);
  });

  it('mock zones are added, listed per member, removed — and stay unchecked', async () => {
    const provider = new MockBasicPhoneMemberProvider(null);
    const seen: SafeZone[][] = [];
    const stop = provider.subscribeZones('me', 'm1', (z) => seen.push(z));
    await provider.addZone('me', { memberId: 'm1', name: 'Home', centre: { latitude: 51.5, longitude: -0.1 }, radiusMeters: 500 });
    await provider.addZone('me', { memberId: 'm2', name: 'Elsewhere', centre: { latitude: 0, longitude: 0 }, radiusMeters: 500 });
    expect(seen[seen.length - 1].map((z) => [z.name, z.state])).toEqual([['Home', 'unknown']]);
    await provider.deleteZone('me', seen[seen.length - 1][0].id);
    expect(seen[seen.length - 1]).toEqual([]);
    stop();
  });
});
