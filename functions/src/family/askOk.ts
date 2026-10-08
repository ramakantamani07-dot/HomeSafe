import * as logger from 'firebase-functions/logger';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';

import { db, messaging } from '../shared/firebase';
import { isDeadTokenError } from '../shared/messaging';
import type { StoredFamilyConnection, StoredSharedStatus, StoredUser } from '../shared/types';

/**
 * Must match `ASK_OK_CATEGORY` in the app's notification setup: iOS shows the
 * I'm OK / SOS buttons only for a category the app registered.
 */
export const ASK_OK_CATEGORY = 'wayloc.ok-request';

/**
 * One ask per watcher per member per five minutes. "Ask OK?" is a nudge to
 * someone walking home; repeated, it becomes the opposite of reassurance —
 * pressure on a person who may simply be crossing a road.
 */
export const ASK_OK_MIN_INTERVAL_MS = 5 * 60 * 1_000;

export type AskOkRefusal = 'not-member' | 'not-travelling' | 'too-soon';

/**
 * Whether an ask may be sent. Pure, so the order is testable: membership,
 * then whether they are on a journey as the asker is allowed to see it, then
 * the interval.
 */
export function gateAskOk(input: {
  connection: StoredFamilyConnection | undefined;
  askerId: string;
  memberStatus: string | null;
  lastAskedAt: Date | null;
  now: Date;
}): AskOkRefusal | null {
  const c = input.connection;
  if (!c || c.status !== 'ACTIVE' || (c.user1Id !== input.askerId && c.user2Id !== input.askerId)) {
    return 'not-member';
  }
  // Read from what they share with the asker, so a member who shares nothing
  // cannot be pinged by someone guessing they might be out.
  if (input.memberStatus !== 'TRAVELLING') return 'not-travelling';
  if (input.lastAskedAt && input.now.getTime() - input.lastAskedAt.getTime() < ASK_OK_MIN_INTERVAL_MS) {
    return 'too-soon';
  }
  return null;
}

/**
 * Ask "OK?" (Option 15 S2c): a push to someone on a journey asking them to
 * say they are OK. Their answer comes back through their shared status as a
 * fresh "I'm OK" time — no reply channel of its own, and nothing the asker
 * sees that the member did not choose to send.
 *
 * Returns whether a device was reached. A member with no registered device is
 * not an error, but it is not "asked" either, and the screen must not say so.
 */
export const askMemberOk = onCall(async (request) => {
  const askerId = request.auth?.uid;
  if (!askerId) throw new HttpsError('unauthenticated', 'Sign in to ask.');
  const connectionId = (request.data as { connectionId?: unknown } | null)?.connectionId;
  if (typeof connectionId !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(connectionId)) {
    throw new HttpsError('invalid-argument', 'Unknown connection.');
  }

  const connRef = db.doc(`familyConnections/${connectionId}`);
  const askRef = connRef.collection('okRequests').doc(askerId);

  const decision = await db.runTransaction(async (tx) => {
    const connection = (await tx.get(connRef)).data() as StoredFamilyConnection | undefined;
    const memberId = connection
      ? connection.user1Id === askerId
        ? connection.user2Id
        : connection.user1Id
      : null;
    const [status, last] = await Promise.all([
      memberId ? tx.get(connRef.collection('sharedStatus').doc(memberId)) : Promise.resolve(null),
      tx.get(askRef),
    ]);
    const now = new Date();
    const refusal = gateAskOk({
      connection,
      askerId,
      memberStatus: (status?.data() as StoredSharedStatus | undefined)?.status ?? null,
      lastAskedAt: (last.data()?.at as Timestamp | undefined)?.toDate() ?? null,
      now,
    });
    if (refusal || !memberId) return { refusal: refusal ?? ('not-member' as const), memberId: null };
    tx.set(askRef, { at: Timestamp.fromDate(now) });
    return { refusal: null, memberId };
  });

  if (decision.refusal || !decision.memberId) {
    const refusal = decision.refusal ?? 'not-member';
    throw new HttpsError(
      refusal === 'too-soon' ? 'resource-exhausted' : refusal === 'not-member' ? 'permission-denied' : 'failed-precondition',
      refusal,
      { refusal },
    );
  }

  const [member, asker] = await Promise.all([
    db.doc(`users/${decision.memberId}`).get(),
    db.doc(`users/${askerId}`).get(),
  ]);
  const token = (member.data() as StoredUser | undefined)?.fcmToken?.trim();
  if (!token) return { delivered: false };

  const askerName = (asker.data() as StoredUser | undefined)?.name?.trim() || 'Someone in your family';
  try {
    await messaging.send({
      token,
      notification: {
        title: `${askerName} is asking if you're OK`,
        body: "Tap I'm OK to let them know.",
      },
      data: { type: 'OK_REQUESTED', connectionId },
      android: { priority: 'high' },
      apns: { payload: { aps: { category: ASK_OK_CATEGORY, sound: 'default' } } },
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (isDeadTokenError(code)) await member.ref.update({ fcmToken: '' }).catch(() => {});
    logger.warn('Ask OK push failed', { code });
    return { delivered: false };
  }
  return { delivered: true };
});
