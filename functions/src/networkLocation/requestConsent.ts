import * as logger from 'firebase-functions/logger';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { Timestamp, type DocumentReference } from 'firebase-admin/firestore';

import { db } from '../shared/firebase';
import type { StoredConsent } from '../shared/types';
import { getAdapters } from './adapters';
import { CONSENT_REQUEST_TTL_MS, isMarketEnabled, marketForNumber } from './config';
import { guardianNameFor, sendMemberSms } from './memberSms';
import { gateResend } from './planning';

/** E.164: a plus, a non-zero country digit, and at most fifteen digits in all. */
const E164 = /^\+[1-9]\d{6,14}$/;

/**
 * Sends the layer-1 consent request when a guardian asks (spec §4 step 3).
 *
 * A guardian's device writes the consent document in `PENDING_SMS` — the one
 * state a client may create — and this reacts to it, in keeping with "a
 * Firestore write is the interface" (ARCHITECTURE §6).
 *
 * **Claims before sending.** Firestore triggers are delivered at least once,
 * and a duplicate delivery must not text someone twice asking the same thing.
 * A transaction stamps `requestSms` first; whichever delivery wins the stamp
 * sends, and the rest see it and stop. A crash between stamp and send leaves
 * it at `sending` — one unsent request, never two sent ones.
 *
 * The claim also resets the server-owned fields from server values, whatever
 * the client wrote. The rules already refuse them on create; this is the
 * second lock, because these fields are what the rate limit, the transparency
 * throttle and the request deadline are computed from.
 */
export const requestConsentSms = onDocumentCreated(
  'users/{userId}/consents/{memberId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const ref = snap.ref;
    const { userId } = event.params;

    const claimed = await db.runTransaction(async (tx) => {
      const current = await tx.get(ref);
      const consent = current.data() as StoredConsent | undefined;
      if (!consent || consent.status !== 'PENDING_SMS' || consent.requestSms) return null;

      const now = Timestamp.now();
      tx.update(ref, {
        requestedAt: now,
        expiresAt: Timestamp.fromMillis(now.toMillis() + CONSENT_REQUEST_TTL_MS),
        recentLookupsAt: [],
        lastNoticeAt: null,
        requestSms: { status: 'sending', at: now },
      });
      tx.create(db.collection(`users/${userId}/consentEvents`).doc(), {
        memberId: consent.memberId,
        from: null,
        to: 'PENDING_SMS',
        trigger: 'guardian-requested',
        note: null,
        at: now,
      });
      return consent;
    });
    if (!claimed) return;
    await deliverConsentRequest(ref, userId, claimed.phoneNumber);
  },
);

/**
 * Texts the consent request and records whether it got out.
 *
 * The guardian's screen reads `requestSms` to say "we couldn't text them"
 * rather than "waiting for their reply" — the second would be untrue of
 * someone who was never told. Returns the recorded status.
 */
async function deliverConsentRequest(
  ref: DocumentReference,
  userId: string,
  phone: string,
): Promise<'sent' | 'failed' | 'unavailable'> {
  const adapters = getAdapters();
  const deliverable =
    adapters !== null && E164.test(phone) && isMarketEnabled(marketForNumber(phone));

  let status: 'sent' | 'failed' | 'unavailable' = 'unavailable';
  if (deliverable) {
    try {
      const sent = await sendMemberSms(adapters, phone, 'consent-request', await guardianNameFor(userId));
      status = sent ? 'sent' : 'unavailable';
    } catch (err) {
      status = 'failed';
      logger.error('Consent request SMS failed', { error: (err as Error).message });
    }
  }

  await ref.update({ requestSms: { status, at: Timestamp.now() } });
  return status;
}

const MEMBER_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * "Resend consent text" (Option 15 S3; spec §4 step 5).
 *
 * A callable rather than a client write: the client may only create a consent
 * or revoke it (D17), and both the limit and the new deadline must be set by
 * the server — a client trusted with either could reset its own limit.
 *
 * The gate and the reservation are one transaction, so two quick taps cannot
 * both pass. Each resend opens a fresh reply window; a request that had lapsed
 * unanswered is still `PENDING_SMS` (expiry is lazy, D19), so resending revives
 * it — the member will be reading a new message, and deserves the full window.
 */
export const resendConsentRequest = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to resend.');
  const memberId = (request.data as { memberId?: unknown } | null)?.memberId;
  if (typeof memberId !== 'string' || !MEMBER_ID.test(memberId)) {
    throw new HttpsError('invalid-argument', 'Unknown member.');
  }

  const ref = db.doc(`users/${uid}/consents/${memberId}`);
  const outcome = await db.runTransaction(async (tx) => {
    const consent = (await tx.get(ref)).data() as StoredConsent | undefined;
    if (!consent) return { refusal: 'not-pending' as const, phone: null };

    const now = new Date();
    const previous = (consent.resendsAt ?? []).map((t) => t.toDate());
    const refusal = gateResend(consent.status, previous, now);
    if (refusal) return { refusal, phone: null };

    tx.update(ref, {
      resendsAt: [...previous, now].map((d) => Timestamp.fromDate(d)),
      expiresAt: Timestamp.fromMillis(now.getTime() + CONSENT_REQUEST_TTL_MS),
      requestSms: { status: 'sending', at: Timestamp.fromDate(now) },
    });
    return { refusal: null, phone: consent.phoneNumber };
  });

  if (outcome.refusal || !outcome.phone) {
    const refusal = outcome.refusal ?? 'not-pending';
    throw new HttpsError(
      refusal === 'not-pending' ? 'failed-precondition' : 'resource-exhausted',
      refusal,
      { refusal },
    );
  }

  return { delivery: await deliverConsentRequest(ref, uid, outcome.phone) };
});
