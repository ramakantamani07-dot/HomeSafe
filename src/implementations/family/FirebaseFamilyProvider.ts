import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  Firestore,
} from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';

import type { FamilyProvider, InviteMemberInput, CreateConnectionInput } from '../../providers/FamilyProvider';
import type {
  FamilyConnection,
  FamilyConnectionStatus,
  FamilyInvitation,
  FamilyPermissions,
  FamilyStatusSnapshot,
  SharedFamilyView,
} from '../../models/Family';
import type { Coordinates } from '../../models/Journey';
import {
  computeConnectionId,
  defaultFamilyPermissions,
  INVITATION_EXPIRY_DAYS,
} from '../../models/Family';

// ─── Firestore document shapes ────────────────────────────────────────────────

type StoredInvitation = {
  fromUserId: string;
  fromDisplayName: string;
  fromPhone: string;
  toPhone: string;
  relationship: string;
  status: FamilyInvitation['status'];
  createdAt: Timestamp;
  expiresAt: Timestamp;
};

type StoredConnection = {
  user1Id: string;
  user2Id: string;
  user1DisplayName: string;
  user2DisplayName: string;
  user1Phone: string;
  user2Phone: string;
  relationship: string;
  status: FamilyConnectionStatus;
  initiatedBy: string;
  user1Permissions: FamilyPermissions;
  user2Permissions: FamilyPermissions;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type StoredStatus = {
  userId: string;
  status: string;
  batteryLevel: number | null;
  lastSeen: Timestamp;
  activeJourneyId: string | null;
  activeJourneyDestination: string | null;
  activeJourneyEta: Timestamp | null;
  location: Coordinates | null;
  updatedAt: Timestamp;
};

// `status: null` means "nothing shared" — see SharedFamilyView.
type StoredSharedStatus = {
  status: string | null;
  batteryLevel: number | null;
  lastSeen: Timestamp | null;
  activeJourneyId: string | null;
  activeJourneyDestination: string | null;
  activeJourneyEta: Timestamp | null;
  location: Coordinates | null;
};

// ─── Converters ───────────────────────────────────────────────────────────────

function invitationFromFirestore(id: string, data: StoredInvitation): FamilyInvitation {
  return {
    id,
    fromUserId: data.fromUserId,
    fromDisplayName: data.fromDisplayName,
    fromPhone: data.fromPhone,
    toPhone: data.toPhone,
    relationship: data.relationship,
    status: data.status,
    createdAt: data.createdAt.toDate(),
    expiresAt: data.expiresAt.toDate(),
  };
}

function connectionFromFirestore(id: string, data: StoredConnection): FamilyConnection {
  return {
    id,
    user1Id: data.user1Id,
    user2Id: data.user2Id,
    user1DisplayName: data.user1DisplayName,
    user2DisplayName: data.user2DisplayName,
    user1Phone: data.user1Phone,
    user2Phone: data.user2Phone,
    relationship: data.relationship,
    status: data.status,
    initiatedBy: data.initiatedBy,
    user1Permissions: data.user1Permissions,
    user2Permissions: data.user2Permissions,
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
  };
}

function statusFromFirestore(data: StoredStatus): FamilyStatusSnapshot {
  return {
    userId: data.userId,
    status: data.status as FamilyStatusSnapshot['status'],
    batteryLevel: data.batteryLevel,
    lastSeen: data.lastSeen.toDate(),
    activeJourneyId: data.activeJourneyId,
    activeJourneyDestination: data.activeJourneyDestination,
    activeJourneyEta: data.activeJourneyEta ? data.activeJourneyEta.toDate() : null,
    location: data.location ?? null,
    updatedAt: data.updatedAt.toDate(),
  };
}

function sharedViewFromFirestore(data: StoredSharedStatus): SharedFamilyView {
  return {
    status: data.status as SharedFamilyView['status'],
    batteryLevel: data.batteryLevel,
    lastSeen: data.lastSeen ? data.lastSeen.toDate() : null,
    activeJourneyId: data.activeJourneyId,
    activeJourneyDestination: data.activeJourneyDestination,
    activeJourneyEta: data.activeJourneyEta ? data.activeJourneyEta.toDate() : null,
    location: data.location ?? null,
  };
}

// ─── Collection helpers ───────────────────────────────────────────────────────

function invitationsCol(db: Firestore) {
  return collection(db, 'familyInvitations');
}

function connectionsCol(db: Firestore) {
  return collection(db, 'familyConnections');
}

function familyStatusDoc(db: Firestore, userId: string) {
  return doc(db, 'users', userId, 'familyStatus', 'current');
}

function sharedStatusDoc(db: Firestore, connectionId: string, publisherUserId: string) {
  return doc(db, 'familyConnections', connectionId, 'sharedStatus', publisherUserId);
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class FirebaseFamilyProvider implements FamilyProvider {
  private readonly db: Firestore;

  constructor(app: FirebaseApp) {
    this.db = getFirestore(app);
  }

  // ─── Invitations ────────────────────────────────────────────────────────────

  async createInvitation(input: InviteMemberInput): Promise<FamilyInvitation> {
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromDate(
      new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    );
    const data: StoredInvitation = {
      fromUserId: input.fromUserId,
      fromDisplayName: input.fromDisplayName,
      fromPhone: input.fromPhone,
      toPhone: input.toPhone,
      relationship: input.relationship,
      status: 'PENDING',
      createdAt: now,
      expiresAt,
    };
    const ref = await addDoc(invitationsCol(this.db), data);
    return invitationFromFirestore(ref.id, data);
  }

  async getPendingInvitationsForPhone(phone: string): Promise<FamilyInvitation[]> {
    const q = query(
      invitationsCol(this.db),
      where('toPhone', '==', phone),
      where('status', '==', 'PENDING'),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => invitationFromFirestore(d.id, d.data() as StoredInvitation));
  }

  async getSentInvitations(userId: string): Promise<FamilyInvitation[]> {
    const q = query(
      invitationsCol(this.db),
      where('fromUserId', '==', userId),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => invitationFromFirestore(d.id, d.data() as StoredInvitation));
  }

  async updateInvitationStatus(
    invitationId: string,
    status: FamilyInvitation['status'],
  ): Promise<void> {
    await updateDoc(doc(invitationsCol(this.db), invitationId), { status });
  }

  // ─── Connections ─────────────────────────────────────────────────────────────

  async createConnection(input: CreateConnectionInput): Promise<FamilyConnection> {
    const connectionId = computeConnectionId(input.fromUserId, input.toUserId);
    const isFromUser1 = input.fromUserId < input.toUserId;

    const now = Timestamp.now();
    const defaultPerms = defaultFamilyPermissions();

    const data: StoredConnection = {
      user1Id: isFromUser1 ? input.fromUserId : input.toUserId,
      user2Id: isFromUser1 ? input.toUserId : input.fromUserId,
      user1DisplayName: isFromUser1 ? input.fromDisplayName : input.toDisplayName,
      user2DisplayName: isFromUser1 ? input.toDisplayName : input.fromDisplayName,
      user1Phone: isFromUser1 ? input.fromPhone : input.toPhone,
      user2Phone: isFromUser1 ? input.toPhone : input.fromPhone,
      relationship: input.fromRelationship,
      status: 'ACTIVE',
      initiatedBy: input.fromUserId,
      user1Permissions: defaultPerms,
      user2Permissions: defaultPerms,
      createdAt: now,
      updatedAt: now,
    };

    const ref = doc(connectionsCol(this.db), connectionId);
    await setDoc(ref, data);
    return connectionFromFirestore(connectionId, data);
  }

  async getConnectionsForUser(userId: string): Promise<FamilyConnection[]> {
    const [snap1, snap2] = await Promise.all([
      getDocs(query(connectionsCol(this.db), where('user1Id', '==', userId))),
      getDocs(query(connectionsCol(this.db), where('user2Id', '==', userId))),
    ]);
    const docs = [...snap1.docs, ...snap2.docs];
    return docs.map((d) => connectionFromFirestore(d.id, d.data() as StoredConnection));
  }

  async updateConnectionStatus(
    connectionId: string,
    status: FamilyConnectionStatus,
  ): Promise<void> {
    await updateDoc(doc(connectionsCol(this.db), connectionId), {
      status,
      updatedAt: Timestamp.now(),
    });
  }

  async updatePermissions(
    connectionId: string,
    isUser1: boolean,
    permissions: FamilyPermissions,
  ): Promise<void> {
    const field = isUser1 ? 'user1Permissions' : 'user2Permissions';
    await updateDoc(doc(connectionsCol(this.db), connectionId), {
      [field]: permissions,
      updatedAt: Timestamp.now(),
    });
  }

  // ─── Live status ─────────────────────────────────────────────────────────────

  async publishOwnStatus(
    userId: string,
    snapshot: Omit<FamilyStatusSnapshot, 'userId'>,
  ): Promise<void> {
    const data: StoredStatus = {
      userId,
      status: snapshot.status,
      batteryLevel: snapshot.batteryLevel,
      lastSeen: Timestamp.fromDate(snapshot.lastSeen),
      activeJourneyId: snapshot.activeJourneyId,
      activeJourneyDestination: snapshot.activeJourneyDestination,
      activeJourneyEta: snapshot.activeJourneyEta
        ? Timestamp.fromDate(snapshot.activeJourneyEta)
        : null,
      location: snapshot.location,
      updatedAt: Timestamp.fromDate(snapshot.updatedAt),
    };
    await setDoc(familyStatusDoc(this.db, userId), data);
  }

  async getOwnStatus(userId: string): Promise<FamilyStatusSnapshot | null> {
    const snap = await getDoc(familyStatusDoc(this.db, userId));
    if (!snap.exists()) return null;
    return statusFromFirestore(snap.data() as StoredStatus);
  }

  async publishSharedStatus(
    connectionId: string,
    publisherUserId: string,
    view: SharedFamilyView,
  ): Promise<void> {
    const data: StoredSharedStatus = {
      status: view.status,
      batteryLevel: view.batteryLevel,
      lastSeen: view.lastSeen ? Timestamp.fromDate(view.lastSeen) : null,
      activeJourneyId: view.activeJourneyId,
      activeJourneyDestination: view.activeJourneyDestination,
      activeJourneyEta: view.activeJourneyEta ? Timestamp.fromDate(view.activeJourneyEta) : null,
      location: view.location,
    };
    await setDoc(sharedStatusDoc(this.db, connectionId, publisherUserId), data);
  }

  async getSharedStatus(
    connectionId: string,
    publisherUserId: string,
  ): Promise<SharedFamilyView | null> {
    const snap = await getDoc(sharedStatusDoc(this.db, connectionId, publisherUserId));
    if (!snap.exists()) return null;
    return sharedViewFromFirestore(snap.data() as StoredSharedStatus);
  }
}
