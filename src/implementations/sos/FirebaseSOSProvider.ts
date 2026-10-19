import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  Timestamp,
  query,
  where,
  limit,
  onSnapshot,
  type Firestore,
  type DocumentReference,
} from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';
import { httpsCallable, type Functions } from 'firebase/functions';

import type { SOSProvider } from '../../providers/SOSProvider';
import type { AcknowledgeOutcome, SOSEvent, SOSStatus, SosResponse } from '../../models/SOS';
import type { Coordinates } from '../../models/Journey';
import { getAppFunctions } from '../../config/firebase';

type StoredSOS = {
  userId: string;
  journeyId: string | null;
  location: Coordinates | null;
  status: SOSStatus;
  triggeredAt: Timestamp;
  resolvedAt: Timestamp | null;
  createdAt: Timestamp;
  duressTriggered?: boolean;
};

function sosCol(db: Firestore, userId: string) {
  return collection(db, 'users', userId, 'sosEvents');
}

function fromFirestore(id: string, data: StoredSOS): SOSEvent {
  return {
    id,
    userId: data.userId,
    journeyId: data.journeyId,
    location: data.location,
    status: data.status,
    triggeredAt: data.triggeredAt.toDate(),
    resolvedAt: data.resolvedAt ? data.resolvedAt.toDate() : null,
    createdAt: data.createdAt.toDate(),
    duressTriggered: data.duressTriggered ?? false,
  };
}

export class FirebaseSOSProvider implements SOSProvider {
  private readonly functions: Functions;

  private readonly db: Firestore;

  constructor(app: FirebaseApp) {
    this.db = getFirestore(app);
    this.functions = getAppFunctions(app);
  }

  async createSOS(
    userId: string,
    journeyId: string | null,
    location: Coordinates | null,
  ): Promise<SOSEvent> {
    const ref = doc(sosCol(this.db, userId));
    return this.writeNewSOS(ref, userId, journeyId, location);
  }

  async createSOSWithId(
    userId: string,
    sosId: string,
    journeyId: string | null,
    location: Coordinates | null,
  ): Promise<SOSEvent> {
    const ref = doc(sosCol(this.db, userId), sosId);
    return this.writeNewSOS(ref, userId, journeyId, location);
  }

  private async writeNewSOS(
    ref: DocumentReference,
    userId: string,
    journeyId: string | null,
    location: Coordinates | null,
  ): Promise<SOSEvent> {
    const now = Timestamp.now();
    const data: StoredSOS = {
      userId,
      journeyId,
      location,
      status: 'ACTIVE',
      triggeredAt: now,
      resolvedAt: null,
      createdAt: now,
      duressTriggered: false,
    };
    await setDoc(ref, data);
    return fromFirestore(ref.id, data);
  }

  async resolveSOS(userId: string, sosId: string): Promise<SOSEvent> {
    const ref = doc(sosCol(this.db, userId), sosId);
    await updateDoc(ref, { status: 'RESOLVED', resolvedAt: Timestamp.now() });
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('SOS event not found after update.');
    return fromFirestore(snap.id, snap.data() as StoredSOS);
  }

  async markDuress(userId: string, sosId: string): Promise<SOSEvent> {
    const ref = doc(sosCol(this.db, userId), sosId);
    await updateDoc(ref, { duressTriggered: true });
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('SOS event not found after update.');
    return fromFirestore(snap.id, snap.data() as StoredSOS);
  }

  async getActiveSOS(userId: string): Promise<SOSEvent | null> {
    const q = query(sosCol(this.db, userId), where('status', '==', 'ACTIVE'), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return fromFirestore(d.id, d.data() as StoredSOS);
  }

  subscribeResponses(userId: string, sosId: string, onChange: (responses: SosResponse[]) => void): () => void {
    return onSnapshot(
      doc(sosCol(this.db, userId), sosId),
      (snap) => {
        const acks = (snap.get('acks') ?? {}) as Record<string, { name?: string; at?: Timestamp }>;
        onChange(
          Object.values(acks)
            .filter((a) => a.name && a.at)
            .map((a) => ({ name: a.name as string, at: (a.at as Timestamp).toDate() })),
        );
      },
      () => onChange([]),
    );
  }

  async acknowledgeSOS(ownerId: string, sosId: string): Promise<AcknowledgeOutcome> {
    const call = httpsCallable<{ ownerId: string; sosId: string }, { status: AcknowledgeOutcome }>(
      this.functions,
      'acknowledgeSos',
    );
    return (await call({ ownerId, sosId })).data.status;
  }
}
