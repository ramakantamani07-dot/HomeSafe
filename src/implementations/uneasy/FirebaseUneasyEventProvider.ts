import {
  getFirestore,
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';

import type { Coordinates } from '../../models/Journey';
import type { UneasyAction, UneasyEvent } from '../../models/UneasyEvent';
import type { UneasyEventProvider } from '../../providers/UneasyEventProvider';

type StoredUneasyEvent = {
  journeyId: string | null;
  action: UneasyAction;
  latitude: number | null;
  longitude: number | null;
  at: Timestamp;
};

/**
 * Under the owner's own tree, like walk feedback and for the same reason: these
 * are notes about how someone felt, and a guardian reading them would change
 * what people are willing to record. The Firestore rules enforce it.
 */
function eventsCol(db: Firestore, userId: string) {
  return collection(db, 'users', userId, 'uneasyEvents');
}

export class FirebaseUneasyEventProvider implements UneasyEventProvider {
  private readonly db: Firestore;

  constructor(app: FirebaseApp) {
    this.db = getFirestore(app);
  }

  async logEvent(
    userId: string,
    action: UneasyAction,
    journeyId: string | null,
    location: Coordinates | null,
  ): Promise<void> {
    const record: StoredUneasyEvent = {
      journeyId,
      action,
      // Split into two nullable scalars rather than a nested object so a missing
      // fix stays explicitly null instead of becoming a half-filled map.
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      at: Timestamp.now(),
    };
    await addDoc(eventsCol(this.db, userId), record);
  }

  async listEvents(userId: string): Promise<UneasyEvent[]> {
    const snap = await getDocs(query(eventsCol(this.db, userId), orderBy('at', 'desc')));
    return snap.docs.map((d) => {
      const data = d.data() as StoredUneasyEvent;
      return {
        id: d.id,
        journeyId: data.journeyId,
        action: data.action,
        location:
          data.latitude !== null && data.longitude !== null
            ? { latitude: data.latitude, longitude: data.longitude }
            : null,
        at: data.at.toDate(),
      };
    });
  }
}
