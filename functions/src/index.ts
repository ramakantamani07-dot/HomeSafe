import * as logger from 'firebase-functions/logger';
import {
  onDocumentCreated,
  onDocumentUpdated,
  type FirestoreEvent,
  type QueryDocumentSnapshot as FunctionsQueryDocumentSnapshot,
  type Change,
} from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp } from 'firebase-admin/app';
import {
  getFirestore,
  Timestamp,
  type QueryDocumentSnapshot,
  type DocumentReference,
} from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

// ---------------------------------------------------------------------------
// Firestore document shapes (mirrors client-side models)
// ---------------------------------------------------------------------------

interface StoredSOS {
  userId: string;
  journeyId: string | null;
  location: { latitude: number; longitude: number } | null;
  status: 'ACTIVE' | 'RESOLVED';
  triggeredAt: Timestamp;
}

interface StoredJourney {
  status: string;
  destinationLabel: string;
}

interface StoredContact {
  name: string;
  phone: string;
}

interface StoredUser {
  name?: string;
  phone?: string;
  fcmToken?: string;
}

// FCM data values must all be strings.
interface AlertData {
  type: 'SOS_TRIGGERED' | 'MISSED_CHECKIN';
  userId: string;
  userName: string;
  journeyId: string;
  timestamp: string;
  location: string; // "lat,lng" or "" when unknown
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Looks up FCM tokens for all of a user's trusted contacts who have the app.
 *
 * Flow:
 *   1. Read contact phone numbers from users/{userId}/contacts.
 *   2. Query the top-level users collection by phone number in batches.
 *   3. Return any non-empty fcmToken values found.
 *
 * Contacts without the app simply won't have a matching user document and are
 * silently skipped. SMS alerts for non-app contacts are out of scope here.
 */
async function getContactFcmTokens(userId: string): Promise<string[]> {
  const contactsSnap = await db
    .collection(`users/${userId}/contacts`)
    .get();

  const phones = contactsSnap.docs
    .map((d: QueryDocumentSnapshot) => (d.data() as StoredContact).phone)
    .filter(Boolean);

  if (phones.length === 0) return [];

  const tokens: string[] = [];

  // Firestore 'in' supports up to 30 values per query.
  const BATCH = 30;
  for (let i = 0; i < phones.length; i += BATCH) {
    const batch = phones.slice(i, i + BATCH);
    const snap = await db
      .collection('users')
      .where('phone', 'in', batch)
      .get();

    snap.docs.forEach((d: QueryDocumentSnapshot) => {
      const token = (d.data() as StoredUser).fcmToken;
      if (token?.trim()) tokens.push(token);
    });
  }

  return tokens;
}

/**
 * Sends an FCM message to each token in parallel.
 * Per-token failures are logged but do not abort the batch.
 */
async function sendAlerts(
  tokens: string[],
  title: string,
  body: string,
  data: AlertData,
): Promise<void> {
  if (tokens.length === 0) {
    logger.info('No FCM tokens found — no alerts sent', { alertType: data.type });
    return;
  }

  const results = await Promise.allSettled(
    tokens.map((token) =>
      messaging.send({
        token,
        notification: { title, body },
        data: data as unknown as Record<string, string>,
        android: { priority: 'high' },
        apns: {
          payload: {
            aps: { contentAvailable: true, sound: 'default' },
          },
        },
      }),
    ),
  );

  const failed = results.filter((r) => r.status === 'rejected').length;
  logger.info(`Alerts sent: ${results.length - failed} ok, ${failed} failed`, {
    alertType: data.type,
  });
}

// ---------------------------------------------------------------------------
// Cloud Functions
// ---------------------------------------------------------------------------

/**
 * Fires when a user triggers SOS.
 * Notifies all trusted contacts who have HomeSafe installed.
 *
 * Payload delivered to contacts:
 *   type          : "SOS_TRIGGERED"
 *   userId        : UID of the user who triggered SOS
 *   userName      : display name of that user
 *   journeyId     : active journey ID at trigger time, or ""
 *   timestamp     : ISO-8601 trigger time
 *   location      : "lat,lng" of last known location, or ""
 */
export const onSOSTriggered = onDocumentCreated(
  'users/{userId}/sosEvents/{sosId}',
  async (event: FirestoreEvent<FunctionsQueryDocumentSnapshot | undefined, { userId: string; sosId: string }>) => {
    const { userId, sosId } = event.params;
    const sos = event.data?.data() as StoredSOS | undefined;
    if (!sos || sos.status !== 'ACTIVE') return;

    const userDoc = await db.doc(`users/${userId}`).get();
    const user = userDoc.data() as StoredUser | undefined;
    const userName = user?.name?.trim() || 'A contact';

    const location = sos.location
      ? `${sos.location.latitude.toFixed(5)},${sos.location.longitude.toFixed(5)}`
      : '';

    const tokens = await getContactFcmTokens(userId);

    logger.info(
      `SOS triggered by user ${userId} (${userName}); notifying ${tokens.length} contacts`,
      { sosId },
    );

    await sendAlerts(
      tokens,
      '🚨 SOS Alert',
      location
        ? `${userName} has triggered an SOS! Last known location: ${location}`
        : `${userName} has triggered an SOS alert!`,
      {
        type: 'SOS_TRIGGERED',
        userId,
        userName,
        journeyId: sos.journeyId ?? '',
        timestamp: sos.triggeredAt.toDate().toISOString(),
        location,
      },
    );
  },
);

/**
 * Fires when a journey document is updated.
 * Sends a missed check-in alert to contacts when status transitions to
 * MISSED_CHECKIN — exactly once, on the status change edge.
 *
 * Payload delivered to contacts:
 *   type          : "MISSED_CHECKIN"
 *   userId        : UID of the user who missed the check-in
 *   userName      : display name of that user
 *   journeyId     : the journey that was missed
 *   timestamp     : ISO-8601 time of status change
 *   location      : "" (no live location at check-in miss time in this phase)
 */
export const onMissedCheckIn = onDocumentUpdated(
  'users/{userId}/journeys/{journeyId}',
  async (event: FirestoreEvent<Change<FunctionsQueryDocumentSnapshot> | undefined, { userId: string; journeyId: string }>) => {
    const { userId, journeyId } = event.params;
    const before = event.data?.before.data() as StoredJourney | undefined;
    const after = event.data?.after.data() as StoredJourney | undefined;

    if (!before || !after) return;
    // Only act on the edge: not-MISSED_CHECKIN → MISSED_CHECKIN
    if (before.status === 'MISSED_CHECKIN') return;
    if (after.status !== 'MISSED_CHECKIN') return;

    const userDoc = await db.doc(`users/${userId}`).get();
    const user = userDoc.data() as StoredUser | undefined;
    const userName = user?.name?.trim() || 'A contact';

    const tokens = await getContactFcmTokens(userId);

    logger.info(
      `Missed check-in for user ${userId} on journey ${journeyId}; notifying ${tokens.length} contacts`,
    );

    await sendAlerts(
      tokens,
      '⚠️ Missed Check-in',
      `${userName} missed their safety check-in on a journey to ${after.destinationLabel}.`,
      {
        type: 'MISSED_CHECKIN',
        userId,
        userName,
        journeyId,
        timestamp: new Date().toISOString(),
        location: '',
      },
    );
  },
);

// ---------------------------------------------------------------------------
// Server-side check-in and retention enforcement
//
// Both jobs exist for the same reason: relying on the client app to police
// itself fails exactly when it matters most — a dead battery, a force-killed
// app, or a user who simply never opens HomeSafe again never runs the
// client-side logic that would otherwise flip a journey to MISSED_CHECKIN or
// purge expired location data. These scheduled functions are the backstop.
// ---------------------------------------------------------------------------

/** Mirrors src/models/CheckIn.ts GRACE_PERIOD_MINUTES — keep these in sync. */
const CHECK_IN_GRACE_PERIOD_MINUTES = 5;

/**
 * Extra buffer beyond the grace period before the server acts. The client is
 * the primary, faster-reacting path when it's alive; this buffer exists so
 * the server never races an in-flight client confirmation — it only steps in
 * once a check-in is unambiguously overdue, not the instant the grace period
 * technically elapses.
 */
const SERVER_SAFETY_BUFFER_MINUTES = 1;

/** Mirrors src/models/DataRetentionPolicy.ts DATA_RETENTION_DAYS — keep in sync. */
const RETENTION_DAYS = {
  completedJourneyLocationHistory: 30,
  cancelledJourneyLocationHistory: 7,
  sosRecords: 90,
};

const FIRESTORE_BATCH_LIMIT = 500;

/** Commits document deletions in chunks of 500 (Firestore batch write limit). */
async function deleteRefsInBatches(refs: DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + FIRESTORE_BATCH_LIMIT)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
}

/** Deletes every document in one journey's locationUpdates subcollection. */
async function purgeLocationUpdates(journeyRef: DocumentReference): Promise<number> {
  const refs = await journeyRef.collection('locationUpdates').listDocuments();
  await deleteRefsInBatches(refs);
  return refs.length;
}

/**
 * Scheduled backstop for missed check-ins.
 *
 * The client (CheckInContext) is the fast path: it flips a journey to
 * MISSED_CHECKIN the instant its own grace-period timer expires, or on
 * reopen if the timer fired while the app was closed. This function is the
 * backstop for when the client never gets a chance to run at all. It only
 * acts once a check-in is overdue by the grace period *plus* a safety
 * buffer (see SERVER_SAFETY_BUFFER_MINUTES), so it can't race a user who is
 * actively confirming safe.
 *
 * It only ever changes the `status` field — the existing onMissedCheckIn
 * trigger above reacts to that same edge (ACTIVE → MISSED_CHECKIN) and sends
 * the actual contact alert, whether the transition was written by the client
 * or by this function. Detection and notification stay separate.
 */
export const detectMissedCheckIns = onSchedule('every 2 minutes', async () => {
  const cutoff = Timestamp.fromMillis(
    Date.now() - (CHECK_IN_GRACE_PERIOD_MINUTES + SERVER_SAFETY_BUFFER_MINUTES) * 60_000,
  );

  const overdue = await db
    .collectionGroup('journeys')
    .where('status', '==', 'ACTIVE')
    .where('nextCheckInAt', '<=', cutoff)
    .get();

  if (overdue.empty) {
    logger.info('detectMissedCheckIns: no overdue journeys');
    return;
  }

  logger.info(`detectMissedCheckIns: flagging ${overdue.size} overdue journey(s)`);

  const docs = overdue.docs;
  for (let i = 0; i < docs.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = db.batch();
    for (const doc of docs.slice(i, i + FIRESTORE_BATCH_LIMIT)) {
      batch.update(doc.ref, { status: 'MISSED_CHECKIN' });
    }
    await batch.commit();
  }
});

/**
 * Scheduled backstop for data retention enforcement (see DATA_RETENTION.md).
 *
 * DataRetentionService and JourneyService.deleteJourneyHistory clean up on
 * the client, but only run when a user actually opens the app. This enforces
 * the same retention windows independent of whether anyone ever does.
 *
 * SOS-triggered journeys are deliberately NOT covered here: JourneyProvider
 * sets SOS_TRIGGERED without setting endedAt (an SOS doesn't necessarily mean
 * the journey is over), so there is currently no defined "age" to measure
 * retention from for that status. Tracked as an open gap in
 * IMPLEMENTATION_PLAN.md rather than guessed at here.
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
});
