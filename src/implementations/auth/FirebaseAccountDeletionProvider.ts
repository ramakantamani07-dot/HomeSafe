import {
  getFirestore,
  collection,
  doc,
  getDocs,
  deleteDoc,
  updateDoc,
  writeBatch,
  deleteField,
  query,
  limit,
  type Firestore,
  type CollectionReference,
} from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';

import type { AccountDeletionProvider } from '../../providers/AccountDeletionProvider';

const BATCH_SIZE = 200;

export class FirebaseAccountDeletionProvider implements AccountDeletionProvider {
  private readonly db: Firestore;

  constructor(app: FirebaseApp) {
    this.db = getFirestore(app);
  }

  async listAllJourneyIds(userId: string): Promise<string[]> {
    const snap = await getDocs(collection(this.db, 'users', userId, 'journeys'));
    return snap.docs.map((d) => d.id);
  }

  async deleteJourneySubCollections(userId: string, journeyId: string): Promise<void> {
    const jRef = doc(this.db, 'users', userId, 'journeys', journeyId);
    await this.deleteCollectionInBatches(collection(jRef, 'locationUpdates'));
    await this.deleteCollectionInBatches(collection(jRef, 'checkIns'));
  }

  async deleteJourney(userId: string, journeyId: string): Promise<void> {
    await deleteDoc(doc(this.db, 'users', userId, 'journeys', journeyId));
  }

  async deleteAllContacts(userId: string): Promise<void> {
    await this.deleteCollectionInBatches(
      collection(this.db, 'users', userId, 'contacts'),
    );
  }

  async deleteAllSosEvents(userId: string): Promise<void> {
    await this.deleteCollectionInBatches(
      collection(this.db, 'users', userId, 'sosEvents'),
    );
  }

  async deleteUserDocument(userId: string): Promise<void> {
    await deleteDoc(doc(this.db, 'users', userId));
  }

  async removeDeviceToken(userId: string): Promise<void> {
    await updateDoc(doc(this.db, 'users', userId), {
      fcmToken: deleteField(),
    });
  }

  private async deleteCollectionInBatches(colRef: CollectionReference): Promise<void> {
    let hasMore = true;
    while (hasMore) {
      const snap = await getDocs(query(colRef, limit(BATCH_SIZE)));
      if (snap.empty) { hasMore = false; break; }
      const batch = writeBatch(this.db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      hasMore = snap.docs.length === BATCH_SIZE;
    }
  }
}
