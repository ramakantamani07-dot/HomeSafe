import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';

import type { WalkFeedback, WalkRating } from '../../models/WalkFeedback';
import type { WalkFeedbackProvider } from '../../providers/WalkFeedbackProvider';

type StoredWalkFeedback = {
  journeyId: string;
  rating: WalkRating;
  at: Timestamp;
};

/**
 * Stored under the owner's own document tree, never under anything a guardian
 * can reach. The Firestore rules make that enforceable rather than merely
 * intended — see firestore.rules, walkFeedback.
 */
function feedbackCol(db: Firestore, userId: string) {
  return collection(db, 'users', userId, 'walkFeedback');
}

export class FirebaseWalkFeedbackProvider implements WalkFeedbackProvider {
  private readonly db: Firestore;

  constructor(app: FirebaseApp) {
    this.db = getFirestore(app);
  }

  async saveFeedback(userId: string, journeyId: string, rating: WalkRating): Promise<void> {
    // Keyed by journey so re-answering replaces rather than accumulating.
    await setDoc(doc(feedbackCol(this.db, userId), journeyId), {
      journeyId,
      rating,
      at: Timestamp.now(),
    } satisfies StoredWalkFeedback);
  }

  async listFeedback(userId: string): Promise<WalkFeedback[]> {
    const snap = await getDocs(feedbackCol(this.db, userId));
    return snap.docs.map((d) => {
      const data = d.data() as StoredWalkFeedback;
      return { journeyId: data.journeyId, rating: data.rating, at: data.at.toDate() };
    });
  }
}
