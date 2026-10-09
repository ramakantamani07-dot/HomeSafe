import { createHash } from 'crypto';
import * as logger from 'firebase-functions/logger';
import { onRequest } from 'firebase-functions/v2/https';
import { Timestamp, type DocumentReference, type QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { db } from '../shared/firebase';
import type { StoredConsent } from '../shared/types';
import { getAdapters } from './adapters';
import { EMERGENCY_NUMBER, INBOUND_DEDUPE_TTL_MS, marketForNumber } from './config';
import { allowsLocationLookup } from './consent';
import { raiseMemberSos, recordMemberCheckIn, type GuardianTarget } from './memberAlerts';
import { classifyMemberMessage, mayBeConsentReply } from './memberMessages';
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

  // Who could act on HELP or a check-in, read *before* any transition — so a
  // member who writes "help, stop" still reaches the guardians they had.
  const active = activeGuardians(snap.docs);
  const meaning = classifyMemberMessage(message.body);

  // HELP and check-ins alert people, which is not safe to repeat on a
  // provider retry, so they claim the message before acting. Consent changes
  // alone are safe to repeat and keep the act-then-mark order (D18).
  const alerts = snap.size > 0 && (meaning.help || (meaning.checkIn !== null && active.length > 0));
  if (alerts) {
    try {
      await seenRef.create({
        processedAt: Timestamp.now(),
        expireAt: Timestamp.fromMillis(Date.now() + INBOUND_DEDUPE_TTL_MS),
      });
    } catch {
      res.status(200).end();
      return;
    }
  }

  const plan = planReply(
    mayBeConsentReply(meaning, active.length > 0) ? message.body : '',
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

  // HELP and check-ins, for a number we know. Unknown numbers have no
  // consents at all and get nothing (spec §7) — a reply would confirm the
  // number means something to us.
  const revoked = plan.transitions.some((t) => t.event === 'revoke');
  let reply = plan.reply;
  let replyCount = 0;
  if (meaning.help && snap.size > 0) {
    replyCount = active.length > 0 ? await raiseMemberSos(adapters, active, 'sms', !revoked) : 0;
    reply = replyCount > 0 ? 'help-sent' : 'help-none';
  } else if (meaning.checkIn && active.length > 0) {
    replyCount = await recordMemberCheckIn(active, meaning.checkIn);
    reply = 'checkin-sent';
  }

  if (!alerts) {
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
  }

  if (reply) {
    const market = marketForNumber(message.from);
    try {
      await sendMemberSms(
        adapters,
        message.from,
        reply,
        active.length === 1 ? await guardianNameFor(active[0].ownerId) : 'wayLoc',
        { count: replyCount, emergencyNumber: market ? EMERGENCY_NUMBER[market] : undefined },
      );
    } catch (err) {
      logger.error('Member reply SMS failed', { template: reply, error: (err as Error).message });
    }
  }

  logger.info('Inbound member SMS handled', {
    transitions: plan.transitions.length,
    help: meaning.help,
    checkIn: meaning.checkIn,
    reply,
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

/** The guardians whose consent for this number is ACTIVE. */
function activeGuardians(docs: QueryDocumentSnapshot[]): GuardianTarget[] {
  return docs
    .filter((d) => allowsLocationLookup((d.data() as StoredConsent).status))
    .map((d) => ({ ownerId: d.ref.parent.parent!.id, memberId: (d.data() as StoredConsent).memberId }));
}

/**
 * A missed call from a member (spec §7) — the SOS for someone who cannot type,
 * or cannot afford to be seen typing. Treated exactly as HELP: every ACTIVE
 * guardian alerted, with a lookup, and a text back saying who was told.
 *
 * Same webhook discipline as SMS: signature first, fail closed when not
 * configured, de-duplicated by the provider's call id, and silent for numbers
 * we do not know.
 */
export const inboundMemberCall = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const adapters = getAdapters();
  if (!adapters) {
    res.status(503).end();
    return;
  }
  const webhook = { headers: req.headers, rawBody: req.rawBody, body: req.body };
  if (!adapters.sms.verifyWebhook(webhook)) {
    logger.warn('Inbound call rejected: bad signature');
    res.status(403).end();
    return;
  }
  const call = adapters.sms.parseInboundCall(webhook);
  if (!call) {
    res.status(200).end();
    return;
  }

  const seenRef = db
    .collection('smsInbound')
    .doc(createHash('sha256').update(`call:${call.providerCallId}`).digest('hex'));
  try {
    // Claimed before acting, unlike texts: an SOS alert repeated on a provider
    // retry would tell guardians twice that someone needs help, and the second
    // alert could read as a second emergency.
    await seenRef.create({
      processedAt: Timestamp.now(),
      expireAt: Timestamp.fromMillis(Date.now() + INBOUND_DEDUPE_TTL_MS),
    });
  } catch {
    res.status(200).end();
    return;
  }

  const snap = await db.collectionGroup('consents').where('phoneNumber', '==', call.from).get();
  if (snap.empty) {
    res.status(200).end();
    return;
  }
  const active = activeGuardians(snap.docs);
  const count = active.length > 0 ? await raiseMemberSos(adapters, active, 'call', true) : 0;

  const market = marketForNumber(call.from);
  try {
    await sendMemberSms(
      adapters,
      call.from,
      count > 0 ? 'help-sent' : 'help-none',
      active.length === 1 ? await guardianNameFor(active[0].ownerId) : 'wayLoc',
      { count, emergencyNumber: market ? EMERGENCY_NUMBER[market] : undefined },
    );
  } catch (err) {
    logger.error('Missed-call reply SMS failed', { error: (err as Error).message });
  }
  logger.info('Inbound member call handled', { guardians: count });
  res.status(200).end();
});
