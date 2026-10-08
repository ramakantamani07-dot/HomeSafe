import { MockFamilyProvider } from '../implementations/family/MockFamilyProvider';
import { FamilyService } from '../services/FamilyService';
import {
  MAX_SHARED_PATH_POINTS,
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
