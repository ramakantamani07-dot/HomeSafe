import * as logger from 'firebase-functions/logger';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';

import { db } from '../shared/firebase';
import { FIRESTORE_BATCH_LIMIT } from '../shared/batch';

/**
 * Server-side check-in enforcement.
 *
 * Exists because relying on the client to police itself fails exactly when it
 * matters most — a dead battery, a force-killed app, or a user who never opens
 * wayLoc again never runs the client-side logic that would flip a journey to
 * MISSED_CHECKIN. This scheduled job is the backstop.
 */

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
