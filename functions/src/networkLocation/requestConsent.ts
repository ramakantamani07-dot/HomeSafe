import * as logger from 'firebase-functions/logger';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { Timestamp } from 'firebase-admin/firestore';

import { db } from '../shared/firebase';
import type { StoredConsent } from '../shared/types';
import { getAdapters } from './adapters';
import { CONSENT_REQUEST_TTL_MS, isMarketEnabled, marketForNumber } from './config';
import { guardianNameFor, sendMemberSms } from './memberSms';

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

    const adapters = getAdapters();
    const phone = claimed.phoneNumber;
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

    // The guardian's screen reads this to say "we couldn't text them" rather
    // than "waiting for their reply" — the second would be untrue.
    await ref.update({ requestSms: { status, at: Timestamp.now() } });
  },
);
