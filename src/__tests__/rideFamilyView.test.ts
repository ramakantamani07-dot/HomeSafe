import { MockFamilyProvider } from '../implementations/family/MockFamilyProvider';
import { FamilyService } from '../services/FamilyService';
import {
  defaultFamilyPermissions,
  deriveSharedView,
  seesJourneyDetails,
  type FamilyMember,
  type FamilyStatusSnapshot,
} from '../models/Family';
import {
  confirmInRide,
  guardianRideStatus,
  guardianRideSubtitle,
  guardianRideTimeline,
  initialRide,
  shareRide,
  type SharedRide,
} from '../models/Ride';
import { describeMemberStatus } from '../components/circle/memberStatus';

const START = new Date(2026, 9, 19, 21, 44);
const at = (min: number) => new Date(START.getTime() + min * 60_000);

const waiting: SharedRide = shareRide({ travelMode: 'auto', ride: initialRide('auto', 'uber'), startedAt: START })!;
const inAuto: SharedRide = {
  ...shareRide({
    travelMode: 'auto',
    ride: { ...confirmInRide(initialRide('auto', 'uber')!, at(8), 'uber'), vehicleNumber: 'KA 01 AB 1234' },
    startedAt: START,
  })!,
};

describe('what family see of a ride (AP5)', () => {
  it('"getting an auto" until she says she is in — opening Uber is not booking it', () => {
    expect(guardianRideStatus(waiting, 'Home')).toBe('Getting an auto to Home');
    expect(guardianRideSubtitle(waiting)).toBe('Started 21:44 · Uber opened · not confirmed yet');
  });

  it('"in an auto" only once she confirms, with what she told us', () => {
    expect(guardianRideStatus(inAuto, 'Home')).toBe('In an auto to Home');
    expect(guardianRideSubtitle(inAuto)).toBe('Confirmed 21:52 · booked with Uber · KA 01 AB 1234');
  });

  it('the timeline leaves "In the auto" grey until then, and never says "walking to the pickup"', () => {
    const steps = guardianRideTimeline(waiting, 'Priya', 'Home', at(24));
    expect(steps.map((s) => [s.title, s.state, s.meta])).toEqual([
      ['Safe Journey started', 'done', '21:44'],
      ['Getting an auto', 'now', 'now'],
      ['In the auto', 'pending', '—'],
      ['Home', 'pending', '—'],
    ]);
    expect(steps[1].detail).toBe('Pickup allowance until 21:54');
    expect(steps[2].detail).toBe('Shown when Priya confirms');
    expect(steps[3].detail).toBe('Arrive by about 22:08');
    expect(steps.map((s) => s.detail).join(' ')).not.toMatch(/walking/i);

    const later = guardianRideTimeline(inAuto, 'Priya', 'Home', null);
    expect(later[1].state).toBe('done');
    expect(later[2]).toMatchObject({ state: 'now', meta: '21:52', detail: 'Vehicle KA 01 AB 1234' });
    expect(later[3].detail).toBeNull();
  });

  it('no ride on a walk', () => {
    expect(shareRide({ travelMode: 'walk', ride: null, startedAt: START })).toBeNull();
  });
});

describe('the ride is a journey detail', () => {
  const raw: Omit<FamilyStatusSnapshot, 'userId'> = {
    status: 'TRAVELLING',
    batteryLevel: 0.6,
    lastSeen: new Date(),
    activeJourneyId: 'j1',
    activeJourneyDestination: 'Home',
    activeJourneyEta: null,
    location: null,
    journeyProgress: null,
    routePath: null,
    lastCheckInAt: null,
    nextCheckInAt: null,
    ride: inAuto,
    updatedAt: new Date(),
  };

  it('is shared with journey details, vehicle number included, and not without them', () => {
    expect(deriveSharedView(raw, defaultFamilyPermissions()).ride).toEqual(inAuto);
    expect(deriveSharedView(raw, { ...defaultFamilyPermissions(), shareJourneyDetails: false }).ride).toBeNull();
    expect(deriveSharedView(raw, { ...defaultFamilyPermissions(), sharingMode: 'NEVER_SHARE' }).ride).toBeNull();
  });

  it('reaches a watching family member, and goes when the journey ends', async () => {
    const provider = new MockFamilyProvider();
    provider._reset();
    const service = new FamilyService(provider);
    provider._seedConnection({
      id: 'a_b',
      user1Id: 'a',
      user2Id: 'b',
      user1DisplayName: 'Mum',
      user2DisplayName: 'Priya',
      user1Phone: '+919800000001',
      user2Phone: '+919800000002',
      relationship: 'Daughter',
      status: 'ACTIVE',
      initiatedBy: 'a',
      user1Permissions: defaultFamilyPermissions(),
      user2Permissions: defaultFamilyPermissions(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const seen: Array<SharedRide | null> = [];
    const stop = service.watchMemberStatuses([{ id: 'b', connectionId: 'a_b' }], (_id, s) => seen.push(s.ride));
    const publish = (journeyId: string | null) =>
      service.publishStatus('b', {
        activeJourneyId: journeyId,
        activeJourneyDestination: journeyId ? 'Home' : null,
        activeJourneyEta: null,
        activeSosId: null,
        batteryLevel: 0.5,
        location: null,
        routePath: null,
        lastCheckInAt: null,
        nextCheckInAt: null,
        ride: waiting,
      });
    await publish('j1');
    await publish(null);
    stop();
    expect(seen.slice(1)).toEqual([waiting, null]);
  });
});

describe('who the traveller is told can see it', () => {
  const member = (name: string, perms: Partial<FamilyMember['myPermissions']>, status = 'ACTIVE') =>
    ({
      id: name,
      displayName: name,
      connectionStatus: status,
      myPermissions: { ...defaultFamilyPermissions(), ...perms },
    }) as FamilyMember;

  it('names only active members who get journey details', () => {
    const names = seesJourneyDetails([
      member('Mum', {}),
      member('Alex', { shareJourneyDetails: false }),
      member('Sam', { sharingMode: 'NEVER_SHARE' }),
      member('Ravi', {}, 'PENDING'),
    ]).map((m) => m.displayName);
    expect(names).toEqual(['Mum']);
  });

  it('family lists say "Getting an auto to Home"', () => {
    const m = { status: 'TRAVELLING', activeJourneyDestination: 'Home', ride: waiting } as FamilyMember;
    expect(describeMemberStatus(m)).toBe('Getting an auto to Home');
    expect(describeMemberStatus({ ...m, ride: null })).toBe('On the way to Home');
  });
});
