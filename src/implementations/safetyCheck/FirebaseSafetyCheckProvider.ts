import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';

import type { Coordinates } from '../../models/Journey';
import type { SafetyCheck } from '../../models/SafetyCheck';
import type { SafetyCheckReason } from '../../models/AlertRules';
import type { SafetyCheckProvider } from '../../providers/SafetyCheckProvider';

type StoredSafetyCheck = {
  journeyId: string;
  reason: SafetyCheckReason;
  status: SafetyCheck['status'];
  raisedAt: Timestamp;
  escalateAt: Timestamp;
  respondedAt: Timestamp | null;
  escalatedAt: Timestamp | null;
  location: Coordinates | null;
  batteryPercent: number | null;
  extendedByMinutes: number | null;
};

function checksCol(db: Firestore, userId: string, journeyId: string) {
  return collection(db, 'users', userId, 'journeys', journeyId, 'safetyChecks');
}

export class FirebaseSafetyCheckProvider implements SafetyCheckProvider {
  private readonly db: Firestore;

  constructor(app: FirebaseApp) {
    this.db = getFirestore(app);
  }

  async createSafetyCheck(
    userId: string,
    journeyId: string,
    reason: SafetyCheckReason,
    location: Coordinates | null,
    escalateAt: Date,
  ): Promise<SafetyCheck> {
    const ref = doc(checksCol(this.db, userId, journeyId));
    const raisedAt = Timestamp.now();
    const escalateAtTs = Timestamp.fromDate(escalateAt);
    const data: StoredSafetyCheck = {
      journeyId,
      reason,
      status: 'PENDING',
      raisedAt,
      escalateAt: escalateAtTs,
      respondedAt: null,
      escalatedAt: null,
      location: location ?? null,
      batteryPercent: null,
      extendedByMinutes: null,
    };
    await setDoc(ref, data);

    return {
      id: ref.id,
      journeyId,
      reason,
      status: 'PENDING',
      raisedAt: raisedAt.toDate(),
      escalateAt,
      respondedAt: null,
      escalatedAt: null,
      location: location ?? null,
      batteryPercent: null,
      extendedByMinutes: null,
    };
  }

  async resolveSafetyCheck(
    userId: string,
    journeyId: string,
    checkId: string,
    status: 'CONFIRMED' | 'EXTENDED',
    extendedByMinutes: number | null,
  ): Promise<void> {
    await updateDoc(doc(checksCol(this.db, userId, journeyId), checkId), {
      status,
      respondedAt: Timestamp.now(),
      extendedByMinutes,
    });
  }

  async escalateSafetyCheck(
    userId: string,
    journeyId: string,
    checkId: string,
    location: Coordinates | null,
    batteryPercent: number | null,
  ): Promise<void> {
    // The Cloud Function trigger keys off status becoming ESCALATED, so this
    // single write is what notifies every guardian. Location and battery are
    // written in the same update so the alert payload is complete the moment
    // the trigger fires, rather than racing a second write.
    await updateDoc(doc(checksCol(this.db, userId, journeyId), checkId), {
      status: 'ESCALATED',
      escalatedAt: Timestamp.now(),
      location: location ?? null,
      batteryPercent,
    });
  }
}
