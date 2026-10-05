import {
  getFirestore,
  collection,
  doc,
  getDocs,
  query,
  limit,
  startAfter,
  Timestamp,
  type Firestore,
  type CollectionReference,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';

import type { DataExportProvider } from '../../providers/DataExportProvider';

const PAGE_SIZE = 200;

/** Recursively converts Firestore Timestamps to ISO strings so the result is plain JSON. */
function toJsonSafe(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, toJsonSafe(v)]),
    );
  }
  return value;
}

export class FirebaseDataExportProvider implements DataExportProvider {
  private readonly db: Firestore;

  constructor(app: FirebaseApp) {
    this.db = getFirestore(app);
  }

  async exportContacts(userId: string): Promise<Record<string, unknown>[]> {
    return this.exportAllDocs(collection(this.db, 'users', userId, 'contacts'));
  }

  async exportSosEvents(userId: string): Promise<Record<string, unknown>[]> {
    return this.exportAllDocs(collection(this.db, 'users', userId, 'sosEvents'));
  }

  async exportJourneys(userId: string): Promise<Record<string, unknown>[]> {
    const journeysSnap = await getDocs(collection(this.db, 'users', userId, 'journeys'));

    const journeys: Record<string, unknown>[] = [];
    for (const journeyDoc of journeysSnap.docs) {
      const jRef = doc(this.db, 'users', userId, 'journeys', journeyDoc.id);
      const [locationUpdates, checkIns] = await Promise.all([
        this.exportAllDocs(collection(jRef, 'locationUpdates')),
        this.exportAllDocs(collection(jRef, 'checkIns')),
      ]);
      journeys.push({
        id: journeyDoc.id,
        ...(toJsonSafe(journeyDoc.data()) as Record<string, unknown>),
        locationUpdates,
        checkIns,
      });
    }
    return journeys;
  }

  /** Pages through an entire collection (any size) and returns JSON-safe field maps. */
  private async exportAllDocs(colRef: CollectionReference): Promise<Record<string, unknown>[]> {
    const results: Record<string, unknown>[] = [];
    let cursor: QueryDocumentSnapshot<DocumentData> | null = null;

    for (;;) {
      const q: Query<DocumentData> = cursor
        ? query(colRef, startAfter(cursor), limit(PAGE_SIZE))
        : query(colRef, limit(PAGE_SIZE));
      const snap: QuerySnapshot<DocumentData> = await getDocs(q);
      if (snap.empty) break;

      for (const d of snap.docs) {
        results.push({ id: d.id, ...(toJsonSafe(d.data()) as Record<string, unknown>) });
      }
      cursor = snap.docs[snap.docs.length - 1];
      if (snap.docs.length < PAGE_SIZE) break;
    }

    return results;
  }
}
