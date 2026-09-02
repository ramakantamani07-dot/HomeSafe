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
  orderBy,
  limit,
  type Firestore,
} from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';

import type { CheckInProvider, CheckInUpdates } from '../../providers/CheckInProvider';
import type { CheckIn, CheckInStatus } from '../../models/CheckIn';

type StoredCheckIn = {
  journeyId: string;
  scheduledAt: Timestamp;
  respondedAt: Timestamp | null;
  status: CheckInStatus;
  extendedByMinutes: number | null;
  createdAt: Timestamp;
};

function checkInsCol(db: Firestore, userId: string, journeyId: string) {
  return collection(db, 'users', userId, 'journeys', journeyId, 'checkIns');
}

function fromFirestore(id: string, data: StoredCheckIn): CheckIn {
  return {
    id,
    journeyId: data.journeyId,
    scheduledAt: data.scheduledAt.toDate(),
    respondedAt: data.respondedAt ? data.respondedAt.toDate() : null,
    status: data.status,
    extendedByMinutes: data.extendedByMinutes,
    createdAt: data.createdAt.toDate(),
  };
}

export class FirebaseCheckInProvider implements CheckInProvider {
  private readonly db: Firestore;

  constructor(app: FirebaseApp) {
    this.db = getFirestore(app);
  }

  async createCheckIn(userId: string, journeyId: string, scheduledAt: Date): Promise<CheckIn> {
    const ref = doc(checkInsCol(this.db, userId, journeyId));
    return this.writeNewCheckIn(ref, journeyId, scheduledAt);
  }

  async createCheckInWithId(
    userId: string,
    journeyId: string,
    checkInId: string,
    scheduledAt: Date,
  ): Promise<CheckIn> {
    const ref = doc(checkInsCol(this.db, userId, journeyId), checkInId);
    return this.writeNewCheckIn(ref, journeyId, scheduledAt);
  }

  private async writeNewCheckIn(
    ref: import('firebase/firestore').DocumentReference,
    journeyId: string,
    scheduledAt: Date,
  ): Promise<CheckIn> {
    const now = Timestamp.now();
    const data: StoredCheckIn = {
      journeyId,
      scheduledAt: Timestamp.fromDate(scheduledAt),
      respondedAt: null,
      status: 'PENDING',
      extendedByMinutes: null,
      createdAt: now,
    };
    await setDoc(ref, data);
    return fromFirestore(ref.id, data);
  }

  async updateCheckIn(
    userId: string,
    journeyId: string,
    checkInId: string,
    updates: CheckInUpdates,
  ): Promise<CheckIn> {
    const col = checkInsCol(this.db, userId, journeyId);
    const ref = doc(col, checkInId);
    await updateDoc(ref, {
      status: updates.status,
      respondedAt: updates.respondedAt ? Timestamp.fromDate(updates.respondedAt) : null,
      extendedByMinutes: updates.extendedByMinutes,
    });
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Check-in not found after update.');
    return fromFirestore(snap.id, snap.data() as StoredCheckIn);
  }

  async getLatestCheckIn(userId: string, journeyId: string): Promise<CheckIn | null> {
    const col = checkInsCol(this.db, userId, journeyId);
    const q = query(col, orderBy('createdAt', 'desc'), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return fromFirestore(d.id, d.data() as StoredCheckIn);
  }
}
