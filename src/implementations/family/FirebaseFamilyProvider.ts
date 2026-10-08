import {
  getFirestore,
  collection,
  doc,
  getDoc,
  onSnapshot,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  Firestore,
} from 'firebase/firestore';
import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import type { FirebaseApp } from 'firebase/app';

import type { FamilyProvider, InviteMemberInput, CreateConnectionInput } from '../../providers/FamilyProvider';
import type {
  FamilyConnection,
  FamilyConnectionStatus,
  FamilyInvitation,
  FamilyPermissions,
  FamilyStatusSnapshot,
  JourneyProgress,
  AskOkOutcome,
  SharedFamilyView,
  Watcher,
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
  journeyProgress?: JourneyProgress | null;
  routePath?: Coordinates[] | null;
  lastCheckInAt?: Timestamp | null;
  nextCheckInAt?: Timestamp | null;
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
  // Optional: documents written before these fields existed lack them.
  journeyProgress?: JourneyProgress | null;
  routePath?: Coordinates[] | null;
  lastCheckInAt?: Timestamp | null;
  nextCheckInAt?: Timestamp | null;
};

/** The journey fields shared status gained in Phase 5b, both directions. */
function journeyFieldsFromFirestore(data: StoredSharedStatus | StoredStatus) {
  return {
    journeyProgress: data.journeyProgress ?? null,
    routePath: data.routePath ?? null,
    lastCheckInAt: data.lastCheckInAt ? data.lastCheckInAt.toDate() : null,
    nextCheckInAt: data.nextCheckInAt ? data.nextCheckInAt.toDate() : null,
  };
}

function journeyFieldsToFirestore(view: {
  journeyProgress: JourneyProgress | null;
  routePath: Coordinates[] | null;
  lastCheckInAt: Date | null;
  nextCheckInAt: Date | null;
}) {
  return {
    journeyProgress: view.journeyProgress,
    routePath: view.routePath,
    lastCheckInAt: view.lastCheckInAt ? Timestamp.fromDate(view.lastCheckInAt) : null,
    nextCheckInAt: view.nextCheckInAt ? Timestamp.fromDate(view.nextCheckInAt) : null,
  };
}

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
    ...journeyFieldsFromFirestore(data),
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
    ...journeyFieldsFromFirestore(data),
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

function watchersCol(db: Firestore, connectionId: string) {
  return collection(db, 'familyConnections', connectionId, 'watchers');
}

type StoredWatcher = { watcherId: string; name: string; watching: string; until: Timestamp };

function sharedStatusDoc(db: Firestore, connectionId: string, publisherUserId: string) {
  return doc(db, 'familyConnections', connectionId, 'sharedStatus', publisherUserId);
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class FirebaseFamilyProvider implements FamilyProvider {
  private readonly db: Firestore;
  private readonly functions: Functions;

  constructor(app: FirebaseApp) {
    this.db = getFirestore(app);
    this.functions = getFunctions(app);
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
      ...journeyFieldsToFirestore(snapshot),
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
      ...journeyFieldsToFirestore(view),
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

  subscribeSharedStatus(
    connectionId: string,
    publisherUserId: string,
    onChange: (view: SharedFamilyView | null) => void,
  ): () => void {
    return onSnapshot(
      sharedStatusDoc(this.db, connectionId, publisherUserId),
      (snap) => onChange(snap.exists() ? sharedViewFromFirestore(snap.data() as StoredSharedStatus) : null),
      // Keep the last good view: a dropped listener is not a member going offline.
      () => {},
    );
  }

  // ─── Watch presence ──────────────────────────────────────────────────────────

  async announceWatching(connectionId: string, watcher: Watcher): Promise<void> {
    const data: StoredWatcher = {
      watcherId: watcher.watcherId,
      name: watcher.name,
      watching: watcher.watching,
      until: Timestamp.fromDate(watcher.until),
    };
    await setDoc(doc(watchersCol(this.db, connectionId), watcher.watcherId), data);
  }

  async askIfOk(connectionId: string): Promise<AskOkOutcome> {
    try {
      const call = httpsCallable<{ connectionId: string }, { delivered: boolean }>(this.functions, 'askMemberOk');
      const { data } = await call({ connectionId });
      return data.delivered ? 'sent' : 'no-device';
    } catch (err) {
      const refusal = (err as { details?: { refusal?: string } }).details?.refusal;
      return refusal === 'too-soon' || refusal === 'not-travelling' ? refusal : 'failed';
    }
  }

  async stopWatching(connectionId: string, watcherId: string): Promise<void> {
    await deleteDoc(doc(watchersCol(this.db, connectionId), watcherId));
  }

  subscribeWatchers(
    connectionId: string,
    watchedId: string,
    onChange: (watchers: Watcher[]) => void,
  ): () => void {
    return onSnapshot(
      query(watchersCol(this.db, connectionId), where('watching', '==', watchedId)),
      (snap) =>
        onChange(
          snap.docs.map((d) => {
            const w = d.data() as StoredWatcher;
            return { watcherId: w.watcherId, name: w.name, watching: w.watching, until: w.until.toDate() };
          }),
        ),
      () => {},
    );
  }
}
