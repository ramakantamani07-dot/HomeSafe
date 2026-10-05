import type { CollectionReference, DocumentReference } from 'firebase-admin/firestore';

import { db } from './firebase';

/**
 * Batched Firestore deletes.
 *
 * Firestore caps a write batch at 500 operations, so anything deleting an
 * unbounded set — a journey's location trail, a deleted account's documents —
 * has to chunk. Centralised here so the limit is stated once rather than
 * re-derived at each call site.
 */

export const FIRESTORE_BATCH_LIMIT = 500;

/** Commits document deletions in chunks of 500 (Firestore batch write limit). */
export async function deleteRefsInBatches(refs: DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + FIRESTORE_BATCH_LIMIT)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
}

/** Deletes every document in one journey's locationUpdates subcollection. */
export async function purgeLocationUpdates(journeyRef: DocumentReference): Promise<number> {
  const refs = await journeyRef.collection('locationUpdates').listDocuments();
  await deleteRefsInBatches(refs);
  return refs.length;
}

/**
 * Deletes every document directly in a collection. Non-recursive, which is
 * fine for this app's flat sub-collections — anything nested is handled by its
 * own explicit purge (see `purgeLocationUpdates`).
 */
export async function deleteAllDocsInCollection(
  collectionRef: CollectionReference,
): Promise<number> {
  const refs = await collectionRef.listDocuments();
  await deleteRefsInBatches(refs);
  return refs.length;
}
