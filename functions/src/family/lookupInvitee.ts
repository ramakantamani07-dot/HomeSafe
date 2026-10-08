import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';

import { db } from '../shared/firebase';

/**
 * How many numbers one account may check per day. Enough for someone building
 * their family; too few to walk through a phone book.
 */
export const LOOKUP_DAILY_LIMIT = 20;

const E164 = /^\+[1-9]\d{6,14}$/;

/** The UTC day a lookup counts against. */
export function lookupDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Whether one more lookup fits today's allowance. Pure, so the reset is testable. */
export function withinLookupLimit(stored: { day?: string; count?: number } | undefined, now: Date): boolean {
  if (!stored || stored.day !== lookupDay(now)) return true;
  return (stored.count ?? 0) < LOOKUP_DAILY_LIMIT;
}

/**
 * "On wayLoc ✓" on Invite someone (decision F1).
 *
 * Answers one question about one number — does an account use it — and
 * nothing else: no name, no uid. The app asks only for a contact the person
 * just picked from their own phone, so the answer is about someone they know.
 *
 * *The server cannot check that.* A modified client could ask about any
 * number, which is why every lookup counts against a per-account daily limit
 * kept here, out of the client's reach. The limit is the enumeration defence;
 * the contacts-only rule is a courtesy the official app keeps.
 */
export const lookupInvitee = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const phone = (request.data as { phone?: unknown } | null)?.phone;
  if (typeof phone !== 'string' || !E164.test(phone)) {
    throw new HttpsError('invalid-argument', 'Not a phone number.');
  }

  const quotaRef = db.doc(`inviteLookups/${uid}`);
  const allowed = await db.runTransaction(async (tx) => {
    const stored = (await tx.get(quotaRef)).data() as { day?: string; count?: number } | undefined;
    const now = new Date();
    if (!withinLookupLimit(stored, now)) return false;
    const today = lookupDay(now);
    tx.set(quotaRef, {
      day: today,
      count: stored?.day === today ? (stored.count ?? 0) + 1 : 1,
      updatedAt: Timestamp.fromDate(now),
    });
    return true;
  });
  if (!allowed) throw new HttpsError('resource-exhausted', 'limit', { refusal: 'limit' });

  const match = await db.collection('users').where('phone', '==', phone).limit(1).get();
  return { onWayloc: !match.empty };
});
