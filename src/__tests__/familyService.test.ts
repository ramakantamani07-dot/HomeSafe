import { FamilyService } from '../services/FamilyService';
import { MockFamilyProvider } from '../implementations/family/MockFamilyProvider';
import type { FamilyInvitation, FamilyConnection } from '../models/Family';
import { computeConnectionId, defaultFamilyPermissions } from '../models/Family';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeService() {
  const provider = new MockFamilyProvider();
  const service = new FamilyService(provider);
  return { provider, service };
}

function futureDate(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function pastDate(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

const USER_A = {
  id: 'user-alpha',
  name: 'Alice',
  phone: '+919999900001',
};
const USER_B = {
  id: 'user-beta',
  name: 'Bob',
  phone: '+919999900002',
};

// ─── 1. Inviting a member ─────────────────────────────────────────────────────

test('inviteMember creates a PENDING invitation', async () => {
  const { service, provider } = makeService();

  const inv = await service.inviteMember(
    USER_A.id,
    USER_A.name,
    USER_A.phone,
    USER_B.phone,
    'Parent',
  );

  expect(inv.status).toBe('PENDING');
  expect(inv.fromUserId).toBe(USER_A.id);
  expect(inv.toPhone).toBe(USER_B.phone);
  expect(inv.relationship).toBe('Parent');
  expect(inv.expiresAt.getTime()).toBeGreaterThan(Date.now());
});

test('inviteMember rejects invalid phone number', async () => {
  const { service } = makeService();
  await expect(
    service.inviteMember(USER_A.id, USER_A.name, USER_A.phone, '12345', 'Parent'),
  ).rejects.toThrow('valid phone number');
});

test('inviteMember rejects self-invitation', async () => {
  const { service } = makeService();
  await expect(
    service.inviteMember(USER_A.id, USER_A.name, USER_A.phone, USER_A.phone, 'Parent'),
  ).rejects.toThrow('cannot invite yourself');
});

test('inviteMember rejects when already connected to that phone', async () => {
  const { service, provider } = makeService();

  // Seed an existing active connection that includes USER_B's phone
  const connId = computeConnectionId(USER_A.id, USER_B.id);
  provider._seedConnection({
    id: connId,
    user1Id: USER_A.id < USER_B.id ? USER_A.id : USER_B.id,
    user2Id: USER_A.id < USER_B.id ? USER_B.id : USER_A.id,
    user1DisplayName: USER_A.name,
    user2DisplayName: USER_B.name,
    user1Phone: USER_A.id < USER_B.id ? USER_A.phone : USER_B.phone,
    user2Phone: USER_A.id < USER_B.id ? USER_B.phone : USER_A.phone,
    relationship: 'Sibling',
    status: 'ACTIVE',
    initiatedBy: USER_A.id,
    user1Permissions: defaultFamilyPermissions(),
    user2Permissions: defaultFamilyPermissions(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await expect(
    service.inviteMember(USER_A.id, USER_A.name, USER_A.phone, USER_B.phone, 'Parent'),
  ).rejects.toThrow('already connected');
});

// ─── 2. Accepting an invitation ───────────────────────────────────────────────

test('acceptInvitation creates an ACTIVE connection', async () => {
  const { service, provider } = makeService();

  const pendingInv: FamilyInvitation = {
    id: 'inv-1',
    fromUserId: USER_A.id,
    fromDisplayName: USER_A.name,
    fromPhone: USER_A.phone,
    toPhone: USER_B.phone,
    relationship: 'Sibling',
    status: 'PENDING',
    createdAt: new Date(),
    expiresAt: futureDate(7),
  };
  provider._seedInvitation(pendingInv);

  const connection = await service.acceptInvitation(
    'inv-1',
    USER_B.id,
    USER_B.name,
    USER_B.phone,
  );

  expect(connection.status).toBe('ACTIVE');
  expect([connection.user1Id, connection.user2Id]).toContain(USER_A.id);
  expect([connection.user1Id, connection.user2Id]).toContain(USER_B.id);
});

test('acceptInvitation marks the invitation as ACCEPTED', async () => {
  const { service, provider } = makeService();

  provider._seedInvitation({
    id: 'inv-2',
    fromUserId: USER_A.id,
    fromDisplayName: USER_A.name,
    fromPhone: USER_A.phone,
    toPhone: USER_B.phone,
    relationship: 'Parent',
    status: 'PENDING',
    createdAt: new Date(),
    expiresAt: futureDate(7),
  });

  await service.acceptInvitation('inv-2', USER_B.id, USER_B.name, USER_B.phone);

  const sent = await provider.getSentInvitations(USER_A.id);
  const inv = sent.find((i) => i.id === 'inv-2');
  expect(inv?.status).toBe('ACCEPTED');
});

test('acceptInvitation throws for an expired invitation', async () => {
  const { service, provider } = makeService();

  provider._seedInvitation({
    id: 'inv-exp',
    fromUserId: USER_A.id,
    fromDisplayName: USER_A.name,
    fromPhone: USER_A.phone,
    toPhone: USER_B.phone,
    relationship: 'Parent',
    status: 'PENDING',
    createdAt: pastDate(10),
    expiresAt: pastDate(3), // already expired
  });

  await expect(
    service.acceptInvitation('inv-exp', USER_B.id, USER_B.name, USER_B.phone),
  ).rejects.toThrow();
});

// ─── 3. Removing a member ─────────────────────────────────────────────────────

test('removeMember cancels the connection', async () => {
  const { service, provider } = makeService();

  const connId = computeConnectionId(USER_A.id, USER_B.id);
  provider._seedConnection({
    id: connId,
    user1Id: USER_A.id,
    user2Id: USER_B.id,
    user1DisplayName: USER_A.name,
    user2DisplayName: USER_B.name,
    user1Phone: USER_A.phone,
    user2Phone: USER_B.phone,
    relationship: 'Sibling',
    status: 'ACTIVE',
    initiatedBy: USER_A.id,
    user1Permissions: defaultFamilyPermissions(),
    user2Permissions: defaultFamilyPermissions(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await service.removeMember(connId, USER_A.id);

  const connections = await provider.getConnectionsForUser(USER_A.id);
  expect(connections[0].status).toBe('CANCELLED');
});

test('removeMember throws when connection not found', async () => {
  const { service } = makeService();
  await expect(service.removeMember('nonexistent', USER_A.id)).rejects.toThrow(
    'Connection not found',
  );
});

// ─── 4. Permission enforcement ────────────────────────────────────────────────

test('getFamilyMembers hides status when member sets NEVER_SHARE', async () => {
  const { service, provider } = makeService();

  const connId = computeConnectionId(USER_A.id, USER_B.id);
  const neverSharePerms = { ...defaultFamilyPermissions(), sharingMode: 'NEVER_SHARE' as const };

  provider._seedConnection({
    id: connId,
    user1Id: USER_A.id,
    user2Id: USER_B.id,
    user1DisplayName: USER_A.name,
    user2DisplayName: USER_B.name,
    user1Phone: USER_A.phone,
    user2Phone: USER_B.phone,
    relationship: 'Sibling',
    status: 'ACTIVE',
    initiatedBy: USER_A.id,
    user1Permissions: defaultFamilyPermissions(),
    user2Permissions: neverSharePerms, // B does not share with A
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Publish through the real path so write-time filtering is what's under test —
  // not a hand-seeded read-time value.
  await service.publishStatus(USER_B.id, {
    activeJourneyId: 'j-123',
    activeJourneyDestination: 'Office',
    activeJourneyEta: new Date(Date.now() + 30 * 60 * 1000),
    activeSosId: null,
    batteryLevel: 0.5,
  });

  const members = await service.getFamilyMembers(USER_A.id);
  const bob = members.find((m) => m.id === USER_B.id);

  // B has NEVER_SHARE — all fields should be hidden
  expect(bob?.status).toBe('OFFLINE');
  expect(bob?.batteryLevel).toBeNull();
  expect(bob?.activeJourneyId).toBeNull();
});

test('updatePermissions saves only the requesting user\'s permission slot', async () => {
  const { service, provider } = makeService();

  const connId = computeConnectionId(USER_A.id, USER_B.id);
  const isAUser1 = USER_A.id < USER_B.id;

  provider._seedConnection({
    id: connId,
    user1Id: isAUser1 ? USER_A.id : USER_B.id,
    user2Id: isAUser1 ? USER_B.id : USER_A.id,
    user1DisplayName: isAUser1 ? USER_A.name : USER_B.name,
    user2DisplayName: isAUser1 ? USER_B.name : USER_A.name,
    user1Phone: isAUser1 ? USER_A.phone : USER_B.phone,
    user2Phone: isAUser1 ? USER_B.phone : USER_A.phone,
    relationship: 'Parent',
    status: 'ACTIVE',
    initiatedBy: USER_A.id,
    user1Permissions: defaultFamilyPermissions(),
    user2Permissions: defaultFamilyPermissions(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const newPerms = { ...defaultFamilyPermissions(), sharingMode: 'NEVER_SHARE' as const };
  await service.updatePermissions(connId, USER_A.id, newPerms);

  const connections = await provider.getConnectionsForUser(USER_A.id);
  const conn = connections[0];

  // Only A's side changes
  const aPerms = isAUser1 ? conn.user1Permissions : conn.user2Permissions;
  const bPerms = isAUser1 ? conn.user2Permissions : conn.user1Permissions;

  expect(aPerms.sharingMode).toBe('NEVER_SHARE');
  expect(bPerms.sharingMode).toBe('SHARE_DURING_JOURNEY'); // unchanged
});

// ─── 5. Journey visibility ────────────────────────────────────────────────────

test('getFamilyMembers shows journey details when SHARE_ALWAYS with shareJourneyDetails:true', async () => {
  const { service, provider } = makeService();

  const connId = computeConnectionId(USER_A.id, USER_B.id);
  const shareAllPerms = {
    ...defaultFamilyPermissions(),
    sharingMode: 'SHARE_ALWAYS' as const,
    shareJourneyDetails: true,
  };

  provider._seedConnection({
    id: connId,
    user1Id: USER_A.id,
    user2Id: USER_B.id,
    user1DisplayName: USER_A.name,
    user2DisplayName: USER_B.name,
    user1Phone: USER_A.phone,
    user2Phone: USER_B.phone,
    relationship: 'Spouse',
    status: 'ACTIVE',
    initiatedBy: USER_A.id,
    user1Permissions: defaultFamilyPermissions(),
    user2Permissions: shareAllPerms, // B shares everything with A
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await service.publishStatus(USER_B.id, {
    activeJourneyId: 'j-456',
    activeJourneyDestination: 'Airport',
    activeJourneyEta: new Date(Date.now() + 60 * 60 * 1000),
    activeSosId: null,
    batteryLevel: 0.8,
  });

  const members = await service.getFamilyMembers(USER_A.id);
  const bob = members.find((m) => m.id === USER_B.id);

  expect(bob?.status).toBe('TRAVELLING');
  expect(bob?.activeJourneyId).toBe('j-456');
  expect(bob?.activeJourneyDestination).toBe('Airport');
});

// ─── 6. Privacy settings ─────────────────────────────────────────────────────

test('SHARE_DURING_JOURNEY mode hides status when no active journey', async () => {
  const { service, provider } = makeService();

  const connId = computeConnectionId(USER_A.id, USER_B.id);
  const duringJourneyPerms = {
    ...defaultFamilyPermissions(),
    sharingMode: 'SHARE_DURING_JOURNEY' as const,
  };

  provider._seedConnection({
    id: connId,
    user1Id: USER_A.id,
    user2Id: USER_B.id,
    user1DisplayName: USER_A.name,
    user2DisplayName: USER_B.name,
    user1Phone: USER_A.phone,
    user2Phone: USER_B.phone,
    relationship: 'Child',
    status: 'ACTIVE',
    initiatedBy: USER_A.id,
    user1Permissions: defaultFamilyPermissions(),
    user2Permissions: duringJourneyPerms,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await service.publishStatus(USER_B.id, {
    activeJourneyId: null, // No active journey
    activeJourneyDestination: null,
    activeJourneyEta: null,
    activeSosId: null,
    batteryLevel: 1.0,
  });

  const members = await service.getFamilyMembers(USER_A.id);
  const bob = members.find((m) => m.id === USER_B.id);

  // No active journey → SHARE_DURING_JOURNEY means nothing visible
  expect(bob?.status).toBe('OFFLINE');
  expect(bob?.batteryLevel).toBeNull();
});

// ─── 7. Status derivation ─────────────────────────────────────────────────────

test('publishStatus derives TRAVELLING when activeJourneyId is set', async () => {
  const { service, provider } = makeService();

  await service.publishStatus(USER_A.id, {
    activeJourneyId: 'j-789',
    activeJourneyDestination: 'Mall',
    activeJourneyEta: new Date(Date.now() + 20 * 60_000),
    activeSosId: null,
    batteryLevel: 0.9,
  });

  const snapshot = await provider.getOwnStatus(USER_A.id);
  expect(snapshot?.status).toBe('TRAVELLING');
  expect(snapshot?.activeJourneyId).toBe('j-789');
});

test('publishStatus derives SOS_ACTIVE when activeSosId is set', async () => {
  const { service, provider } = makeService();

  await service.publishStatus(USER_A.id, {
    activeJourneyId: 'j-789',
    activeJourneyDestination: 'Mall',
    activeJourneyEta: null,
    activeSosId: 'sos-1',
    batteryLevel: 0.3,
  });

  const snapshot = await provider.getOwnStatus(USER_A.id);
  expect(snapshot?.status).toBe('SOS_ACTIVE');
});

test('publishStatus derives HOME when no journey and no SOS', async () => {
  const { service, provider } = makeService();

  await service.publishStatus(USER_A.id, {
    activeJourneyId: null,
    activeJourneyDestination: null,
    activeJourneyEta: null,
    activeSosId: null,
    batteryLevel: 1.0,
  });

  const snapshot = await provider.getOwnStatus(USER_A.id);
  expect(snapshot?.status).toBe('HOME');
});

test('publishStatus derives ARRIVED when journey just completed', async () => {
  const { service, provider } = makeService();

  await service.publishStatus(
    USER_A.id,
    {
      activeJourneyId: null,
      activeJourneyDestination: null,
      activeJourneyEta: null,
      activeSosId: null,
      batteryLevel: 0.7,
    },
    true, // wasTravelling
    true, // journeyJustCompleted
  );

  const snapshot = await provider.getOwnStatus(USER_A.id);
  expect(snapshot?.status).toBe('ARRIVED');
});

// ─── 8. Offline behaviour ────────────────────────────────────────────────────

test('getFamilyMembers treats member as OFFLINE when lastSeen > 30 minutes ago', async () => {
  const { service, provider } = makeService();

  const connId = computeConnectionId(USER_A.id, USER_B.id);
  provider._seedConnection({
    id: connId,
    user1Id: USER_A.id,
    user2Id: USER_B.id,
    user1DisplayName: USER_A.name,
    user2DisplayName: USER_B.name,
    user1Phone: USER_A.phone,
    user2Phone: USER_B.phone,
    relationship: 'Parent',
    status: 'ACTIVE',
    initiatedBy: USER_A.id,
    user1Permissions: defaultFamilyPermissions(),
    user2Permissions: { ...defaultFamilyPermissions(), sharingMode: 'SHARE_ALWAYS' },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Seed the already-filtered shared view directly so we can control lastSeen
  // precisely — publishStatus always stamps "now", which staleness needs to
  // be older than.
  provider._seedSharedStatus(connId, USER_B.id, {
    status: 'HOME',
    batteryLevel: 0.5,
    lastSeen: new Date(Date.now() - 35 * 60 * 1000), // 35 minutes ago
    activeJourneyId: null,
    activeJourneyDestination: null,
    activeJourneyEta: null,
  });

  const members = await service.getFamilyMembers(USER_A.id);
  const bob = members.find((m) => m.id === USER_B.id);

  expect(bob?.status).toBe('OFFLINE');
});

test('getFamilyMembers shows OFFLINE when member has no status snapshot', async () => {
  const { service, provider } = makeService();

  const connId = computeConnectionId(USER_A.id, USER_B.id);
  provider._seedConnection({
    id: connId,
    user1Id: USER_A.id,
    user2Id: USER_B.id,
    user1DisplayName: USER_A.name,
    user2DisplayName: USER_B.name,
    user1Phone: USER_A.phone,
    user2Phone: USER_B.phone,
    relationship: 'Sibling',
    status: 'ACTIVE',
    initiatedBy: USER_A.id,
    user1Permissions: defaultFamilyPermissions(),
    user2Permissions: defaultFamilyPermissions(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  // No status seeded for USER_B

  const members = await service.getFamilyMembers(USER_A.id);
  const bob = members.find((m) => m.id === USER_B.id);
  expect(bob?.status).toBe('OFFLINE');
});

// ─── 9. Declining and cancelling ─────────────────────────────────────────────

test('declineInvitation marks invitation as DECLINED', async () => {
  const { service, provider } = makeService();

  provider._seedInvitation({
    id: 'inv-dec',
    fromUserId: USER_A.id,
    fromDisplayName: USER_A.name,
    fromPhone: USER_A.phone,
    toPhone: USER_B.phone,
    relationship: 'Other',
    status: 'PENDING',
    createdAt: new Date(),
    expiresAt: futureDate(7),
  });

  await service.declineInvitation('inv-dec');

  const pending = await provider.getPendingInvitationsForPhone(USER_B.phone);
  expect(pending.find((i) => i.id === 'inv-dec')).toBeUndefined();
});

test('cancelInvitation marks invitation as CANCELLED', async () => {
  const { service, provider } = makeService();

  provider._seedInvitation({
    id: 'inv-can',
    fromUserId: USER_A.id,
    fromDisplayName: USER_A.name,
    fromPhone: USER_A.phone,
    toPhone: USER_B.phone,
    relationship: 'Other',
    status: 'PENDING',
    createdAt: new Date(),
    expiresAt: futureDate(7),
  });

  await service.cancelInvitation('inv-can');

  const sent = await provider.getSentInvitations(USER_A.id);
  expect(sent.find((i) => i.id === 'inv-can')?.status).toBe('CANCELLED');
});

// ─── 10. Firestore rule static checks (mirrors firestoreRules.test.ts) ────────

import * as fs from 'fs';
import * as path from 'path';

describe('Firestore rules cover family collections', () => {
  const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');
  const rulesContent = fs.existsSync(RULES_PATH)
    ? fs.readFileSync(RULES_PATH, 'utf8')
    : '';

  test('rules file contains familyConnections match block', () => {
    expect(rulesContent).toContain('match /familyConnections/{connectionId}');
  });

  test('rules file contains familyInvitations match block', () => {
    expect(rulesContent).toContain('match /familyInvitations/{invitationId}');
  });

  test('rules allow recipient to read invitation by phone JWT claim', () => {
    expect(rulesContent).toContain('request.auth.token.phone_number');
  });

  test('rules protect familyStatus under user document', () => {
    expect(rulesContent).toContain('match /familyStatus/{doc}');
  });

  test('rules check for active family connection before cross-user read', () => {
    expect(rulesContent).toContain('familyConnections');
    expect(rulesContent).toContain("status == 'ACTIVE'");
  });
});
