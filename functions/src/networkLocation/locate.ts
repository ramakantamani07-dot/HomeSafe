import * as logger from 'firebase-functions/logger';
import { HttpsError, onCall, type FunctionsErrorCode } from 'firebase-functions/v2/https';
import { Timestamp, type DocumentReference } from 'firebase-admin/firestore';

import { db } from '../shared/firebase';
import type { StoredConsent } from '../shared/types';
import { getAdapters } from './adapters';
import { LOCATE_MAX_AGE_SECONDS, isMarketEnabled, marketForNumber } from './config';
import { allowsLocationLookup, pruneAttempts } from './consent';
import { guardianNameFor, sendMemberSms } from './memberSms';
import {
  gateLocate,
  shouldSendTransparencyNotice,
  type LocateDenial,
  type LocateReason,
} from './planning';
import { OperatorError, type OperatorFailure, type OperatorFix } from './ports';
import { consentRef } from './store';
import { metric } from '../shared/metrics';

/**
 * Mirrors `NetworkLocationFailure` in `src/providers/NetworkLocationProvider.ts`
 * — the reasons a screen can explain to a guardian.
 */
export type LocateFailure =
  | 'not-guardian'
  | 'no-consent'
  | 'rate-limited'
  | 'operator-unavailable'
  | OperatorFailure;

export type LocateResult =
  | { ok: true; fix: OperatorFix }
  | { ok: false; failure: LocateFailure };

const DENIAL_FAILURE: Readonly<Record<LocateDenial, LocateFailure>> = {
  'denied-not-guardian': 'not-guardian',
  'denied-no-consent': 'no-consent',
  'denied-rate-limited': 'rate-limited',
};

export type AuditOutcome = LocateDenial | 'success' | 'provider-error';

/**
 * The single guarded lookup (Phase 6.3). Manual, SOS and geofence lookups all
 * come through here, so none can skip a check. In the spec's order:
 *
 *   guardian → consent ACTIVE → rate limit → provider → audit → transparency SMS
 *
 * **The gate and the rate-limit reservation are one transaction.** Two taps of
 * Find racing each other cannot both pass a limit that only one should: the
 * attempt is recorded on the consent document in the same write that permits
 * it.
 *
 * **Consent is checked again after the operator answers.** A lookup takes
 * seconds; a STOP arriving in that window must still win. The fix is discarded
 * rather than returned, and audited as refused — "stop" has to mean the
 * guardian does not see where they are, not merely that the next lookup fails.
 *
 * Every attempt is audited, refused ones included.
 */
export async function locate(
  ownerId: string,
  memberId: string,
  reason: LocateReason,
): Promise<LocateResult> {
  const ref = consentRef(ownerId, memberId);
  const memberRef = db.doc(`users/${ownerId}/basicPhoneMembers/${memberId}`);
  const now = new Date();

  const gate = await db.runTransaction(async (tx) => {
    const [member, snap] = await Promise.all([tx.get(memberRef), tx.get(ref)]);
    const consent = snap.data() as StoredConsent | undefined;
    const recent = pruneAttempts(
      (consent?.recentLookupsAt ?? []).map((t) => t.toDate()),
      now,
    );

    const denial = gateLocate({
      isGuardian: member.exists,
      consentStatus: consent?.status ?? null,
      recentLookupsAt: recent,
      reason,
      now,
    });
    if (denial || !consent) return { denial: denial ?? 'denied-no-consent', consent: null };

    tx.update(ref, {
      recentLookupsAt: [...recent, now].map((d) => Timestamp.fromDate(d)),
    });
    return { denial: null, consent };
  });

  if (gate.denial || !gate.consent) {
    const denial = gate.denial ?? 'denied-no-consent';
    metric('locate', { outcome: denial, reason, latencyMs: null, failure: null, billedUnits: 0 });
    await writeAudit(ownerId, memberId, reason, denial, null);
    return { ok: false, failure: DENIAL_FAILURE[denial] };
  }

  const phone = gate.consent.phoneNumber;
  const adapters = getAdapters();
  if (!adapters || !isMarketEnabled(marketForNumber(phone))) {
    await writeAudit(ownerId, memberId, reason, 'provider-error', null);
    return { ok: false, failure: 'operator-unavailable' };
  }

  let fix: OperatorFix;
  const startedAt = Date.now();
  try {
    fix = await adapters.operator.retrieve(phone, LOCATE_MAX_AGE_SECONDS);
  } catch (err) {
    const failure = err instanceof OperatorError ? err.failure : 'unknown';
    metric('locate', { outcome: 'provider-error', reason, latencyMs: Date.now() - startedAt, failure, billedUnits: 1 });
    logger.warn('Operator lookup failed', { failure, reason });
    await writeAudit(ownerId, memberId, reason, 'provider-error', null);
    return { ok: false, failure };
  }

  const after = (await ref.get()).data() as StoredConsent | undefined;
  if (!after || !allowsLocationLookup(after.status)) {
    await writeAudit(ownerId, memberId, reason, 'denied-no-consent', null);
    return { ok: false, failure: 'no-consent' };
  }

  metric('locate', { outcome: 'success', reason, latencyMs: Date.now() - startedAt, failure: null, billedUnits: 1 });
  await writeAudit(ownerId, memberId, reason, 'success', fix);
  await notifyMember(ownerId, ref, phone);
  return { ok: true, fix };
}

export async function writeAudit(
  ownerId: string,
  memberId: string,
  reason: LocateReason,
  outcome: AuditOutcome,
  fix: OperatorFix | null,
): Promise<void> {
  // Shape mirrors `LocateAudit` in src/models/LocateAudit.ts.
  await db.collection(`users/${ownerId}/locateAudits`).add({
    memberId,
    requestedBy: ownerId,
    reason,
    outcome,
    location: fix ? { latitude: fix.latitude, longitude: fix.longitude } : null,
    accuracyMeters: fix?.radiusMeters ?? null,
    // Lets the retention job find audits that still hold a location with one
    // equality filter, rather than an inequality on `location` itself.
    hasLocation: fix !== null,
    at: Timestamp.now(),
  });
}

/**
 * The transparency text (spec §5): throttled to one an hour, never disabled.
 *
 * The throttle is claimed before sending and released if the send fails, so a
 * provider outage means the *next* lookup tells them — not that an hour passes
 * in which they are found without knowing.
 */
async function notifyMember(
  ownerId: string,
  ref: DocumentReference,
  phone: string,
): Promise<void> {
  const previous = await db.runTransaction(async (tx) => {
    const consent = (await tx.get(ref)).data() as StoredConsent | undefined;
    const last = consent?.lastNoticeAt ?? null;
    if (!shouldSendTransparencyNotice(last?.toDate() ?? null, new Date())) return undefined;
    tx.update(ref, { lastNoticeAt: Timestamp.now() });
    return last;
  });
  if (previous === undefined) return;

  const adapters = getAdapters();
  try {
    if (!adapters) throw new Error('No SMS adapter');
    await sendMemberSms(adapters, phone, 'transparency', await guardianNameFor(ownerId));
  } catch (err) {
    logger.error('Transparency SMS failed; will retry on next lookup', { error: (err as Error).message });
    await ref.update({ lastNoticeAt: previous });
  }
}

const HTTPS_CODE: Readonly<Record<LocateFailure, FunctionsErrorCode>> = {
  'not-guardian': 'permission-denied',
  'no-consent': 'failed-precondition',
  'rate-limited': 'resource-exhausted',
  'operator-unavailable': 'unavailable',
  'device-unreachable': 'unavailable',
  'operator-unsupported': 'unavailable',
  roaming: 'unavailable',
  timeout: 'deadline-exceeded',
  unknown: 'internal',
};

const MEMBER_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * "Find" from the guardian's app — what `NetworkLocationProvider.retrieve`
 * calls.
 *
 * The reason is always `manual`. A client cannot claim `sos` to slip past the
 * rate limit: SOS lookups start from the member's own text or missed call,
 * server-side (Phase 6.6), and call `locate` directly.
 */
export const locateMember = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to find someone.');

  const memberId = (request.data as { memberId?: unknown } | null)?.memberId;
  if (typeof memberId !== 'string' || !MEMBER_ID.test(memberId)) {
    throw new HttpsError('invalid-argument', 'Unknown member.');
  }

  const result = await locate(uid, memberId, 'manual');
  if (!result.ok) {
    throw new HttpsError(HTTPS_CODE[result.failure], result.failure, { failure: result.failure });
  }
  return {
    latitude: result.fix.latitude,
    longitude: result.fix.longitude,
    radiusMeters: result.fix.radiusMeters,
    observedAt: result.fix.observedAt.toISOString(),
  };
});
