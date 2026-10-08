import * as logger from 'firebase-functions/logger';
import { onSchedule } from 'firebase-functions/v2/scheduler';
// firebase-functions v2 still has no auth onDelete trigger — tracked upstream at
// github.com/firebase/firebase-functions/issues/1383, unresolved as of this writing.
// The v1 namespace remains the only way to get this trigger type and is explicitly
// supported to coexist with v2 functions in the same codebase. Revisit if v2 adds parity.
import * as functionsV1 from 'firebase-functions/v1';
import { Timestamp } from 'firebase-admin/firestore';

import { db } from '../shared/firebase';
import type { StoredConsent } from '../shared/types';
import { isTerminal } from '../networkLocation/consent';
import { transitionConsent } from '../networkLocation/store';
import {
  FIRESTORE_BATCH_LIMIT,
  deleteAllDocsInCollection,
  deleteRefsInBatches,
  purgeLocationUpdates,
} from '../shared/batch';

/**
 * Data retention and account deletion.
 *
 * Same backstop rationale as the check-in job: expired location data must be
 * purged whether or not the user ever reopens the app, and an account deleted
 * through Firebase Auth must take its Firestore data with it.
 */

/** Mirrors src/models/DataRetentionPolicy.ts DATA_RETENTION_DAYS — keep in sync. */
const RETENTION_DAYS = {
  completedJourneyLocationHistory: 30,
  cancelledJourneyLocationHistory: 7,
  sosRecords: 90,
  networkLocationFixes: 30,
};

const DAY_MS = 24 * 60 * 60 * 1000;


/**
 * Scheduled backstop for data retention enforcement (see docs/reference/DATA_RETENTION.md).
 *
 * DataRetentionService and JourneyService.deleteJourneyHistory clean up on
 * the client, but only run when a user actually opens the app. This enforces
 * the same retention windows independent of whether anyone ever does.
 *
 * SOS-triggered journeys are deliberately NOT covered here — not an open gap
 * but a decision (see docs/reference/DATA_RETENTION.md): JourneyProvider sets SOS_TRIGGERED
 * without setting endedAt, and a journey stuck there was either never
 * resolved or resolved with the duress code (which intentionally leaves
 * status untouched). Either way this is exactly the data an emergency
 * touched, kept indefinitely on purpose, same as an unresolved SOS event
 * record below.
 *
 * SOS event records use `resolvedAt`, not `triggeredAt`, as the age
 * reference, and are scoped to `status == 'RESOLVED'` — an open/ACTIVE SOS
 * record must never be auto-deleted regardless of how old it is.
 */
export const enforceDataRetention = onSchedule('every 24 hours', async () => {
  const now = Date.now();
  const completedCutoff = Timestamp.fromMillis(
    now - RETENTION_DAYS.completedJourneyLocationHistory * 24 * 60 * 60 * 1000,
  );
  const shortCutoff = Timestamp.fromMillis(
    now - RETENTION_DAYS.cancelledJourneyLocationHistory * 24 * 60 * 60 * 1000,
  );
  const sosCutoff = Timestamp.fromMillis(
    now - RETENTION_DAYS.sosRecords * 24 * 60 * 60 * 1000,
  );

  const completed = await db
    .collectionGroup('journeys')
    .where('status', '==', 'COMPLETED')
    .where('endedAt', '<=', completedCutoff)
    .get();

  const cancelledOrMissed = await db
    .collectionGroup('journeys')
    .where('status', 'in', ['CANCELLED', 'MISSED_CHECKIN'])
    .where('endedAt', '<=', shortCutoff)
    .get();

  let locationUpdatesDeleted = 0;
  for (const doc of [...completed.docs, ...cancelledOrMissed.docs]) {
    locationUpdatesDeleted += await purgeLocationUpdates(doc.ref);
  }

  logger.info(
    `enforceDataRetention: purged locationUpdates for ${completed.size + cancelledOrMissed.size} ` +
      `journey(s), ${locationUpdatesDeleted} location record(s) total`,
  );

  const oldResolvedSos = await db
    .collectionGroup('sosEvents')
    .where('status', '==', 'RESOLVED')
    .where('resolvedAt', '<=', sosCutoff)
    .get();
  await deleteRefsInBatches(oldResolvedSos.docs.map((d) => d.ref));

  logger.info(`enforceDataRetention: deleted ${oldResolvedSos.size} resolved SOS record(s)`);

  const fixesCleared = await clearOldNetworkFixes(
    Timestamp.fromMillis(now - RETENTION_DAYS.networkLocationFixes * DAY_MS),
  );
  logger.info(`enforceDataRetention: cleared location from ${fixesCleared} locate audit(s)`);
});

/**
 * Removes the operator-reported location from locate audits past retention.
 *
 * The audit stays and only the coordinates go. "Who looked me up, and when" is
 * what the member or a regulator will ask about, long after "where was I" has
 * stopped being worth keeping.
 *
 * Paged, because unlike the journey queries above this collection grows with
 * every Find, and one unbounded read would eventually exceed a function's
 * memory.
 */
export async function clearOldNetworkFixes(cutoff: Timestamp): Promise<number> {
  let cleared = 0;
  for (;;) {
    const page = await db
      .collectionGroup('locateAudits')
      .where('hasLocation', '==', true)
      .where('at', '<=', cutoff)
      .limit(FIRESTORE_BATCH_LIMIT)
      .get();
    if (page.empty) return cleared;

    const batch = db.batch();
    for (const doc of page.docs) {
      batch.update(doc.ref, { location: null, accuracyMeters: null, hasLocation: false });
    }
    await batch.commit();
    cleared += page.size;
  }
}

/**
 * Server-side safety net for account deletion.
 *
 * AccountDeletionService on the client already deletes Firestore data before
 * removing the Auth account (see docs/reference/SECURITY_REVIEW.md §6) — Auth is deleted
 * last specifically so the Firestore steps still have a valid auth token.
 * But that sequence can be interrupted: network loss mid-deletion, the app
 * being killed, or a partial failure while paging through a large journey
 * history in batches of 200. This trigger fires whenever a Firebase Auth
 * account is deleted, by any path, and sweeps any Firestore data for that uid
 * that might have been left behind. If the client's own deletion already
 * succeeded, every query here simply returns empty — this is a safe no-op in
 * the common case, not just the failure case.
 *
 * Deliberately NOT touched here: pending familyInvitations addressed *to*
 * this user's phone number (toPhone) rather than sent *by* their uid. An
 * invitation is addressed to a phone number, not an account — if that number
 * is later reused, the invitation may still be meaningful to whoever signs up
 * with it. Only invitations this uid sent are cleaned up.
 */
export const onUserAccountDeleted = functionsV1.auth.user().onDelete(async (user) => {
  const uid = user.uid;
  const userRef = db.collection('users').doc(uid);

  const journeyRefs = await userRef.collection('journeys').listDocuments();
  let locationUpdatesDeleted = 0;
  let checkInsDeleted = 0;
  for (const journeyRef of journeyRefs) {
    locationUpdatesDeleted += await deleteAllDocsInCollection(
      journeyRef.collection('locationUpdates'),
    );
    checkInsDeleted += await deleteAllDocsInCollection(journeyRef.collection('checkIns'));
  }
  await deleteRefsInBatches(journeyRefs);

  // Consent is a permission granted *to this guardian*. With the guardian gone,
  // nothing should remain that would let it be exercised, so every live
  // consent is revoked — through the state machine, so the audit trail says
  // why. The consent and its events are kept as evidence; the members are not.
  const consents = await userRef.collection('consents').get();
  let consentsRevoked = 0;
  for (const doc of consents.docs) {
    if (isTerminal((doc.data() as StoredConsent).status)) continue;
    if (await transitionConsent(doc.ref, 'revoke', 'account deleted', 'guardian-removed')) {
      consentsRevoked++;
    }
  }
  const basicMembersDeleted = await deleteAllDocsInCollection(
    userRef.collection('basicPhoneMembers'),
  );

  const contactsDeleted = await deleteAllDocsInCollection(userRef.collection('contacts'));
  const sosEventsDeleted = await deleteAllDocsInCollection(userRef.collection('sosEvents'));
  await deleteAllDocsInCollection(userRef.collection('familyStatus'));
  await userRef.delete();

  // Family connections are cancelled, not hard-deleted — consistent with the
  // client-side removeMember flow and firestore.rules, which disallows client
  // deletes of familyConnections for the same reason: history is kept.
  const [asUser1, asUser2] = await Promise.all([
    db.collection('familyConnections').where('user1Id', '==', uid).get(),
    db.collection('familyConnections').where('user2Id', '==', uid).get(),
  ]);
  const connections = [...asUser1.docs, ...asUser2.docs];
  for (let i = 0; i < connections.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = db.batch();
    for (const doc of connections.slice(i, i + FIRESTORE_BATCH_LIMIT)) {
      batch.update(doc.ref, { status: 'CANCELLED', updatedAt: Timestamp.now() });
    }
    await batch.commit();
  }
  // This user's own published view is no longer meaningful once the account is gone.
  for (const conn of connections) {
    await conn.ref.collection('sharedStatus').doc(uid).delete().catch(() => {});
  }

  const sentInvitations = await db
    .collection('familyInvitations')
    .where('fromUserId', '==', uid)
    .get();
  await deleteRefsInBatches(sentInvitations.docs.map((d) => d.ref));

  logger.info(
    `onUserAccountDeleted: swept ${uid} — ${journeyRefs.length} journey(s) ` +
      `(${locationUpdatesDeleted} location update(s), ${checkInsDeleted} check-in(s)), ` +
      `${contactsDeleted} contact(s), ${sosEventsDeleted} SOS record(s), ` +
      `${connections.length} connection(s) cancelled, ${sentInvitations.size} invitation(s) removed, ` +
      `${consentsRevoked} consent(s) revoked, ${basicMembersDeleted} basic-phone member(s) removed`,
  );
});
