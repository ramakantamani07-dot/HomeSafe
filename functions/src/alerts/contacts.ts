import * as logger from 'firebase-functions/logger';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';

import { db } from '../shared/firebase';
import { getAlertRecipients, sendAlerts } from '../shared/messaging';
import type { StoredContact, StoredUser } from '../shared/types';
import { textContacts } from './contactSms';

/** One test alert per hour: enough to check, too few to become a nuisance. */
export const TEST_ALERT_MIN_INTERVAL_MS = 60 * 60 * 1_000;

/** Whether another test may be sent. Pure, so the interval is testable. */
export function testAlertAllowed(lastSentAt: Date | null, now: Date): boolean {
  return lastSentAt === null || now.getTime() - lastSentAt.getTime() >= TEST_ALERT_MIN_INTERVAL_MS;
}

async function nameOf(userId: string): Promise<string> {
  const user = (await db.doc(`users/${userId}`).get()).data() as StoredUser | undefined;
  return user?.name?.trim() || 'Someone';
}

interface StoredJourneyStart {
  status: string;
  destinationLabel?: string;
}

/**
 * "I start a journey" (Phase 5c) — only to contacts who switched it on, which
 * nobody is by default: a text every time someone walks home is a lot.
 */
export const onJourneyStarted = onDocumentCreated('users/{userId}/journeys/{journeyId}', async (event) => {
  const journey = event.data?.data() as StoredJourneyStart | undefined;
  if (!journey || journey.status !== 'ACTIVE') return;
  const { userId, journeyId } = event.params;

  const { tokens, sms } = await getAlertRecipients(userId, 'journeyStart');
  if (tokens.length === 0 && sms.length === 0) return;

  const userName = await nameOf(userId);
  const to = journey.destinationLabel?.trim() || 'a destination';
  await textContacts(sms, 'contact-journey', `wayLoc: ${userName} started a journey to ${to}. You'll be told if they miss a check-in.`);
  await sendAlerts(tokens, `${userName} is on the way`, `Heading to ${to}.`, {
    type: 'JOURNEY_STARTED',
    userId,
    userName,
    journeyId,
    timestamp: new Date().toISOString(),
    location: '',
  });
});

/**
 * Lets a new trusted contact know (board: "We'll text Anita to let her know
 * you added her"). Without it, the first they would hear of wayLoc is an SOS.
 */
export const onTrustedContactAdded = onDocumentCreated('users/{userId}/contacts/{contactId}', async (event) => {
  const contact = event.data?.data() as StoredContact | undefined;
  if (!contact?.phone) return;
  const userName = await nameOf(event.params.userId);
  await textContacts(
    [contact.phone],
    'contact-added',
    `wayLoc: ${userName} added you as a trusted contact. If they press SOS, you'll get a text with where they are — you don't need the app.`,
  );
});

/**
 * "Send a test alert" — the same routes as a real alert, push or text per
 * contact, every message marked TEST so nobody acts on it.
 */
export const sendTestAlert = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');

  const ref = db.doc(`testAlerts/${uid}`);
  const allowed = await db.runTransaction(async (tx) => {
    const last = ((await tx.get(ref)).data()?.at as Timestamp | undefined)?.toDate() ?? null;
    const now = new Date();
    if (!testAlertAllowed(last, now)) return false;
    tx.set(ref, { at: Timestamp.fromDate(now) });
    return true;
  });
  if (!allowed) throw new HttpsError('resource-exhausted', 'too-soon', { refusal: 'too-soon' });

  const userName = await nameOf(uid);
  const { tokens, sms } = await getAlertRecipients(uid, 'sos');
  const texted = await textContacts(
    sms,
    'contact-test',
    `wayLoc TEST: ${userName} is checking their alerts reach you. Nothing is wrong — no need to reply.`,
  );
  await sendAlerts(tokens, 'TEST — nothing is wrong', `${userName} is checking that wayLoc alerts reach you.`, {
    type: 'TEST_ALERT',
    userId: uid,
    userName,
    journeyId: '',
    timestamp: new Date().toISOString(),
    location: '',
  });
  logger.info('Test alert sent', { pushed: tokens.length, texted });
  return { pushed: tokens.length, texted };
});
