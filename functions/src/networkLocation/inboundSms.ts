import { createHash } from 'crypto';
import * as logger from 'firebase-functions/logger';
import { onRequest } from 'firebase-functions/v2/https';
import { Timestamp, type DocumentReference } from 'firebase-admin/firestore';

import { db } from '../shared/firebase';
import type { StoredConsent } from '../shared/types';
import { getAdapters } from './adapters';
import { INBOUND_DEDUPE_TTL_MS } from './config';
import { guardianNameFor, sendMemberSms } from './memberSms';
import { planReply } from './planning';
import type { NetworkLocationAdapters } from './ports';
import { ownerIdOf, transitionConsent } from './store';

/**
 * The inbound SMS webhook: YES, NO and — above all — STOP (spec §4 step 4).
 *
 * This is revocation's strongest layer. It never touches the guardian's phone,
 * app or connectivity: the member texts STOP, the carrier calls us, and every
 * consent for that number is revoked server-side, where lookups are gated.
 *
 * **Signature first, always.** An unsigned request that could say "YES from
 * +44…" would let anyone grant consent on someone else's behalf.
 *
 * **Idempotent by construction, not by bookkeeping alone.** Providers retry, so
 * the same message can arrive twice. The state changes are safe to repeat —
 * the state machine refuses a transition that has already happened — so they
 * run first, and the message is only marked seen afterwards. A failure midway
 * therefore leaves the provider's retry able to finish the job: a STOP is never
 * lost to a de-duplication record written before the work it stood for. The
 * mark guards only the reply text, which is the one thing not safe to repeat.
 */
export const inboundConsentSms = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const adapters = getAdapters();
  if (!adapters) {
    // Not configured: refuse loudly so the provider retries once we are,
    // rather than acknowledging a STOP we did nothing with.
    res.status(503).end();
    return;
  }

  const webhook = { headers: req.headers, rawBody: req.rawBody, body: req.body };
  if (!adapters.sms.verifyWebhook(webhook)) {
    logger.warn('Inbound SMS rejected: bad signature');
    res.status(403).end();
    return;
  }

  const message = adapters.sms.parseInbound(webhook);
  if (!message) {
    res.status(200).end();
    return;
  }

  const seenRef = db
    .collection('smsInbound')
    .doc(createHash('sha256').update(message.providerMessageId).digest('hex'));
  if ((await seenRef.get()).exists) {
    res.status(200).end();
    return;
  }

  const snap = await db
    .collectionGroup('consents')
    .where('phoneNumber', '==', message.from)
    .get();

  const plan = planReply(
    message.body,
    snap.docs.map((d) => {
      const c = d.data() as StoredConsent;
      return {
        path: d.ref.path,
        status: c.status,
        expiresAt: c.expiresAt.toDate(),
        requestDelivered: c.requestSms?.status === 'sent',
      };
    }),
    new Date(),
  );

  for (const t of plan.transitions) {
    await transitionConsent(db.doc(t.path), t.event, t.note);
  }
  if (plan.approvedPath) {
    await takeToOperator(adapters, db.doc(plan.approvedPath), message.from);
  }

  try {
    // Holds no number and no text — only that this message id was handled.
    // `expireAt` is for a Firestore TTL policy on this collection.
    await seenRef.create({
      processedAt: Timestamp.now(),
      expireAt: Timestamp.fromMillis(Date.now() + INBOUND_DEDUPE_TTL_MS),
    });
  } catch {
    // A concurrent delivery of the same message got here first and will reply.
    res.status(200).end();
    return;
  }

  if (plan.reply) {
    try {
      await sendMemberSms(adapters, message.from, plan.reply, 'wayLoc');
    } catch (err) {
      logger.error('Consent reply SMS failed', { template: plan.reply, error: (err as Error).message });
    }
  }

  logger.info('Inbound consent SMS handled', {
    transitions: plan.transitions.length,
    reply: plan.reply,
  });
  res.status(200).end();
});

/**
 * Layer 2: asks the member's operator, once the member has said YES.
 *
 * Every step goes through `transitionConsent`, so a STOP arriving while the
 * operator is deciding beats the approval rather than racing it.
 */
async function takeToOperator(
  adapters: NetworkLocationAdapters,
  ref: DocumentReference,
  phoneNumber: string,
): Promise<void> {
  const strategy = adapters.consentStrategyFor(phoneNumber);
  const requested = await transitionConsent(ref, 'operator-requested', strategy.kind);
  if (!requested) return;

  let outcome;
  try {
    outcome = await strategy.request(phoneNumber);
  } catch (err) {
    // Left in OPERATOR_PENDING: not locatable, and honestly described to the
    // guardian as "setting up with their network".
    logger.error('Operator consent request failed', { strategy: strategy.kind, error: (err as Error).message });
    return;
  }

  if (outcome === 'declined') {
    await transitionConsent(ref, 'operator-declined', strategy.kind);
    return;
  }
  // TODO(G3): 'pending' is CIBA — the operator answers later, by callback or
  // `/token` polling. Neither exists until an aggregator is chosen; until then
  // the consent waits in OPERATOR_PENDING, which permits no lookups.
  if (outcome !== 'approved') return;

  const activated = await transitionConsent(ref, 'operator-approved', strategy.kind);
  if (activated?.to !== 'ACTIVE') return;

  try {
    await sendMemberSms(adapters, phoneNumber, 'consent-active', await guardianNameFor(ownerIdOf(ref)));
  } catch (err) {
    logger.error('Consent-active SMS failed', { error: (err as Error).message });
  }
}
