import { MockFamilyProvider } from '../implementations/family/MockFamilyProvider';
import { FamilyService } from '../services/FamilyService';
import {
  MAX_SHARED_PATH_POINTS,
  WATCH_PRESENCE_TTL_MS,
  describeWatchers,
  normaliseContactNumber,
  presentWatchers,
  relationshipLabel,
  defaultFamilyPermissions,
  deriveSharedView,
  measureJourneyProgress,
  simplifyPath,
  type FamilyStatusSnapshot,
} from '../models/Family';

const route = [
  { latitude: 51.5, longitude: -0.13 },
  { latitude: 51.5, longitude: -0.12 },
  { latitude: 51.5, longitude: -0.11 },
  { latitude: 51.5, longitude: -0.1 },
];

describe('measureJourneyProgress', () => {
  it('measures along the route, from the nearest point', () => {
    const p = measureJourneyProgress(route, { latitude: 51.5001, longitude: -0.12 });
    expect(p!.fraction).toBeCloseTo(1 / 3, 2);
    expect(p!.metersRemaining).toBeGreaterThan(1_300);
  });

  it('says nothing rather than guess', () => {
    expect(measureJourneyProgress(route, null)).toBeNull();
    expect(measureJourneyProgress([route[0]], route[0])).toBeNull();
    expect(measureJourneyProgress([route[0], route[0]], route[0])).toBeNull();
  });
});

describe('simplifyPath', () => {
  it('caps the points and keeps both ends', () => {
    const long = Array.from({ length: 500 }, (_, i) => ({ latitude: 51.5, longitude: -0.2 + i / 1_000 }));
    const short = simplifyPath(long);
    expect(short).toHaveLength(MAX_SHARED_PATH_POINTS);
    expect(short[0]).toEqual(long[0]);
    expect(short[short.length - 1]).toEqual(long[long.length - 1]);
  });

  it('leaves a short route alone', () => {
    expect(simplifyPath(route)).toEqual(route);
  });
});

describe('deriveSharedView — the new journey fields follow permissions', () => {
  const raw: Omit<FamilyStatusSnapshot, 'userId'> = {
    status: 'TRAVELLING',
    batteryLevel: 0.6,
    lastSeen: new Date(),
    activeJourneyId: 'j1',
    activeJourneyDestination: 'Home',
    activeJourneyEta: new Date(),
    location: route[1],
    journeyProgress: { fraction: 0.33, metersRemaining: 1_400 },
    routePath: route,
    lastCheckInAt: new Date(),
    nextCheckInAt: new Date(),
    updatedAt: new Date(),
  };
  const perms = { ...defaultFamilyPermissions(), sharingMode: 'SHARE_ALWAYS' as const };

  it('shares them all when journey details and location are shared', () => {
    const v = deriveSharedView(raw, perms);
    expect(v.journeyProgress).not.toBeNull();
    expect(v.routePath).not.toBeNull();
    expect(v.lastCheckInAt).not.toBeNull();
  });

  it('withholds the route and progress without location — together they are a position', () => {
    const v = deriveSharedView(raw, { ...perms, shareLocation: false });
    expect(v.routePath).toBeNull();
    expect(v.journeyProgress).toBeNull();
    expect(v.lastCheckInAt).not.toBeNull();
  });

  it('withholds all of them without journey details', () => {
    const v = deriveSharedView(raw, { ...perms, shareJourneyDetails: false });
    expect([v.journeyProgress, v.routePath, v.lastCheckInAt, v.nextCheckInAt]).toEqual([null, null, null, null]);
  });

  it('withholds everything when nothing is shared', () => {
    const v = deriveSharedView(raw, { ...perms, sharingMode: 'NEVER_SHARE' });
    expect(v.routePath).toBeNull();
    expect(v.lastCheckInAt).toBeNull();
  });
});

describe('live member status', () => {
  it('delivers each publish while watched, and nothing after', async () => {
    const provider = new MockFamilyProvider();
    provider._reset();
    const service = new FamilyService(provider);

    const connectionId = 'a_b';
    provider._seedConnection({
      id: connectionId,
      user1Id: 'a',
      user2Id: 'b',
      user1DisplayName: 'A',
      user2DisplayName: 'B',
      user1Phone: '+447700900001',
      user2Phone: '+447700900002',
      relationship: 'Daughter',
      status: 'ACTIVE',
      initiatedBy: 'a',
      user1Permissions: defaultFamilyPermissions(),
      user2Permissions: { ...defaultFamilyPermissions(), sharingMode: 'SHARE_ALWAYS' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const seen: string[] = [];
    const stop = service.watchMemberStatuses([{ id: 'b', connectionId }], (_id, s) =>
      seen.push(s.status),
    );
    const publish = (activeJourneyId: string | null) =>
      service.publishStatus('b', {
        activeJourneyId,
        activeJourneyDestination: activeJourneyId ? 'Home' : null,
        activeJourneyEta: null,
        activeSosId: null,
        batteryLevel: 0.5,
        location: null,
        routePath: null,
        lastCheckInAt: null,
        nextCheckInAt: null,
      });

    await publish('j1');
    stop();
    await publish(null);

    // The initial (empty) view, then the journey — and nothing once stopped.
    expect(seen).toEqual(['OFFLINE', 'TRAVELLING']);
  });
});

describe('watch presence', () => {
  const now = new Date('2026-10-08T21:00:00Z');
  const w = (id: string, name: string, msFromNow: number) => ({
    watcherId: id,
    name,
    watching: 'emma',
    until: new Date(now.getTime() + msFromNow),
  });

  it('drops a lapsed announcement, and counts each person once', () => {
    const list = presentWatchers([w('mum', 'Mum', 60_000), w('alex', 'Alex', -1), w('mum', 'Mum', 90_000)], now);
    expect(list.map((x) => x.name)).toEqual(['Mum']);
  });

  it('names who is watching', () => {
    expect(describeWatchers([])).toBeNull();
    expect(describeWatchers([w('mum', 'Mum', 1)])).toBe('Mum is watching');
    expect(describeWatchers([w('mum', 'Mum', 1), w('alex', 'Alex', 1)])).toBe('Mum and Alex are watching');
    expect(describeWatchers([w('a', 'Mum', 1), w('b', 'Alex', 1), w('c', 'Sam', 1)])).toBe(
      'Mum and 2 others are watching',
    );
  });

  it('announces until the TTL, merges connections, and withdraws', async () => {
    const provider = new MockFamilyProvider();
    provider._reset();
    const service = new FamilyService(provider);
    const seen: string[][] = [];
    const stop = service.watchWatchers('emma', ['c1', 'c2'], (list) => seen.push(list.map((x) => x.name)));

    await service.announceWatching('c1', 'mum', 'Mum', 'emma', now);
    await service.announceWatching('c2', 'alex', 'Alex', 'emma', now);
    await service.announceWatching('c2', 'alex', 'Alex', 'someone-else', now);
    expect(seen[seen.length - 1].sort()).toEqual(['Mum']);

    await service.stopWatching('c1', 'mum');
    expect(seen[seen.length - 1]).toEqual([]);
    stop();

    const fresh: { until: Date }[] = [];
    service.watchWatchers('emma', ['c1'], (list) => fresh.push(...list));
    await service.announceWatching('c1', 'mum', 'Mum', 'emma', now);
    expect(fresh[0].until.getTime() - now.getTime()).toBe(WATCH_PRESENCE_TTL_MS);
  });
});

describe('relationships (F3)', () => {
  const conn = { relationship: 'Daughter', theyAreMy: 'Daughter', initiatedBy: 'mum' };

  it('shows the inviter what they chose, and the invitee the inverse', () => {
    expect(relationshipLabel(conn, 'mum')).toBe('Daughter');
    expect(relationshipLabel(conn, 'emma')).toBe('Parent');
    expect(relationshipLabel({ ...conn, theyAreMy: 'Parent' }, 'emma')).toBe('Child');
    expect(relationshipLabel({ ...conn, theyAreMy: 'Friend' }, 'emma')).toBe('Friend');
  });

  it('shows nothing rather than guess an inverse', () => {
    expect(relationshipLabel({ ...conn, theyAreMy: 'Other' }, 'emma')).toBe('');
  });

  it('keeps legacy records exactly as they were', () => {
    expect(relationshipLabel({ relationship: 'Sibling', initiatedBy: 'mum' }, 'emma')).toBe('Sibling');
  });

  it('reads contact-card numbers', () => {
    expect(normaliseContactNumber('+91 98765 43210')).toBe('+919876543210');
    expect(normaliseContactNumber('07700 900123')).toBe('+447700900123');
    expect(normaliseContactNumber('0044 7700 900123')).toBe('+447700900123');
    expect(normaliseContactNumber('98765-43210')).toBe('+919876543210');
    expect(normaliseContactNumber('555 0100')).toBeNull();
  });
});
