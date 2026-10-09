import * as logger from 'firebase-functions/logger';
import { Timestamp, type DocumentReference } from 'firebase-admin/firestore';

import { db, messaging } from '../shared/firebase';
import { isDeadTokenError } from '../shared/messaging';
import type { StoredBasicPhoneMember, StoredUser } from '../shared/types';
import { dltTemplateId, isMarketEnabled, localTime, marketForNumber, renderGuardianSosSms } from './config';
import { locate } from './locate';
import type { CheckInLabel } from './memberMessages';
import type { NetworkLocationAdapters } from './ports';
import { metric } from '../shared/metrics';

/** A guardian whose consent for this number was ACTIVE when the member wrote. */
export interface GuardianTarget {
  ownerId: string;
  memberId: string;
}

export type SosSource = 'sms' | 'call';

/**
 * A basic-phone member asked for help (Phase 6.6, spec §7).
 *
 * For each guardian: an immediate lookup through the one guarded `locate`
 * with reason `sos` — which bypasses the hourly limit and nothing else, and is
 * audited — then an event, an urgent push and an SMS. **If the lookup fails,
 * the alert still goes**, saying the location is unavailable: a guardian told
 * late, or not at all, because an operator timed out would be the worst
 * outcome this feature could have.
 *
 * `withLocation: false` is for a member who sent STOP in the same message:
 * sharing stops, but the request for help is still passed on.
 *
 * Returns how many guardians at least one channel reached, so the member is
 * told something true.
 */
export async function raiseMemberSos(
  adapters: NetworkLocationAdapters,
  targets: GuardianTarget[],
  source: SosSource,
  withLocation: boolean,
): Promise<number> {
  const receivedAt = Date.now();
  const results = await Promise.allSettled(
    targets.map(async ({ ownerId, memberId }) => {
      const result = withLocation ? await locate(ownerId, memberId, 'sos') : null;
      const fix = result?.ok ? result.fix : null;
      const at = new Date();

      await db.collection(`users/${ownerId}/memberEvents`).add({
        memberId,
        kind: 'sos',
        source,
        at: Timestamp.fromDate(at),
        location: fix ? { latitude: fix.latitude, longitude: fix.longitude } : null,
        accuracyMeters: fix?.radiusMeters ?? null,
        // Why there is no location, when there is none — for the guardian's
        // screen, and for anyone later asking why an alert had no map.
        failure: fix ? null : result && !result.ok ? result.failure : 'not-requested',
      });

      const [owner, member] = await Promise.all([
        db.doc(`users/${ownerId}`).get(),
        db.doc(`users/${ownerId}/basicPhoneMembers/${memberId}`).get(),
      ]);
      const ownerData = owner.data() as StoredUser | undefined;
      const name = (member.data() as StoredBasicPhoneMember | undefined)?.displayName?.trim() || 'Someone in your circle';
      const market = marketForNumber(ownerData?.phone ?? '');

      const pushed = await pushTo(owner.ref, ownerData?.fcmToken, {
        title: `SOS from ${name}`,
        body: fix ? 'Approximate area found — tap to see it, then call them.' : 'Location unavailable — call them now.',
        data: { type: 'MEMBER_SOS', memberId, at: at.toISOString() },
        urgent: true,
      });

      let texted = false;
      const phone = ownerData?.phone?.trim();
      if (phone && market && isMarketEnabled(market)) {
        try {
          await adapters.sms.send({
            to: phone,
            market,
            template: 'sos-guardian',
            body: renderGuardianSosSms(name, localTime(at, market), fix),
            dltTemplateId: dltTemplateId('sos-guardian', market),
          });
          texted = true;
        } catch (err) {
          logger.error('Guardian SOS SMS failed', { error: (err as Error).message });
        }
      }
      return pushed || texted;
    }),
  );
  const reached = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  // Time from the member's message reaching us to every guardian alert being
  // handed over — the number that matters most in this whole feature.
  metric('member_sos', { source, guardians: targets.length, reached, deliveryMs: Date.now() - receivedAt });
  return reached;
}

/**
 * A check-in by text — HOME, SCHOOL, OK (spec §7): a normal-priority push and
 * an event, no lookup. The member said where they are; nothing needs to be
 * asked of their network.
 */
export async function recordMemberCheckIn(targets: GuardianTarget[], label: CheckInLabel): Promise<number> {
  const results = await Promise.allSettled(
    targets.map(async ({ ownerId, memberId }) => {
      const at = new Date();
      await db.collection(`users/${ownerId}/memberEvents`).add({
        memberId,
        kind: 'checkin',
        label,
        source: 'sms',
        at: Timestamp.fromDate(at),
        location: null,
        accuracyMeters: null,
        failure: null,
      });
      const [owner, member] = await Promise.all([
        db.doc(`users/${ownerId}`).get(),
        db.doc(`users/${ownerId}/basicPhoneMembers/${memberId}`).get(),
      ]);
      const ownerData = owner.data() as StoredUser | undefined;
      const name = (member.data() as StoredBasicPhoneMember | undefined)?.displayName?.trim() || 'Someone';
      const time = localTime(at, marketForNumber(ownerData?.phone ?? ''));
      return pushTo(owner.ref, ownerData?.fcmToken, {
        title: label === 'OK' ? `${name} says they're OK` : `${name} checked in: ${label}`,
        body: `By text, at ${time}.`,
        data: { type: 'MEMBER_CHECKIN', memberId, label },
        urgent: false,
      });
    }),
  );
  metric('member_checkin', { guardians: targets.length });
  return results.filter((r) => r.status === 'fulfilled').length;
}

async function pushTo(
  ownerRef: DocumentReference,
  token: string | undefined,
  message: { title: string; body: string; data: Record<string, string>; urgent: boolean },
): Promise<boolean> {
  const t = token?.trim();
  if (!t) return false;
  try {
    await messaging.send({
      token: t,
      notification: { title: message.title, body: message.body },
      data: message.data,
      android: { priority: message.urgent ? 'high' : 'normal' },
      apns: {
        headers: { 'apns-priority': message.urgent ? '10' : '5' },
        payload: { aps: { sound: 'default', ...(message.urgent ? { 'interruption-level': 'time-sensitive' } : {}) } },
      },
    });
    return true;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (isDeadTokenError(code)) await ownerRef.update({ fcmToken: '' }).catch(() => {});
    metric('push_failed', { kind: message.data.type ?? 'unknown', code: code ?? null });
    logger.warn('Member alert push failed', { code });
    return false;
  }
}
