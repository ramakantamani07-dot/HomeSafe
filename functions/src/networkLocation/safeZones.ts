import * as logger from 'firebase-functions/logger';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp, type QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { db, messaging } from '../shared/firebase';
import { isDeadTokenError } from '../shared/messaging';
import type { StoredBasicPhoneMember, StoredConsent, StoredSafeZone, StoredUser } from '../shared/types';
import { getAdapters } from './adapters';
import { ZONE_CHECK_SCHEDULE, isMarketEnabled, localTime, marketForNumber } from './config';
import { allowsLocationLookup } from './consent';
import { writeAudit } from './locate';
import { guardianNameFor, sendMemberSms } from './memberSms';
import { OperatorError, type NetworkLocationAdapters } from './ports';
import { consentRef } from './store';
import { metric } from '../shared/metrics';
import { ZONES_PER_MEMBER, applyZoneReading, type ZoneEvent } from './zones';

/**
 * Safe zones, checked on a schedule (Phase 6.5, spec §6).
 *
 * **Why a schedule.** The spec's preferred path is CAMARA geofence
 * subscriptions, where the operator tells us; no operator is chosen (G3), so
 * this is its stated fallback: Location Verification at a cost-aware interval,
 * only while consent is ACTIVE. It does nothing — not even a query — when no
 * adapter is configured, so a deployment without the feature pays one idle
 * invocation per interval. **Shutdown plan:** when subscriptions exist for an
 * operator, its members' zones move to them and this skips them; when no
 * member needs polling, delete the export.
 *
 * **Every check goes through the same gate as Find** — guardian, then ACTIVE
 * consent — and is audited with reason `geofence`. It does not use the hourly
 * Find allowance: a yes/no about one circle is a weaker request than a
 * location, and the member was told about the zone when it was made.
 */
export const checkSafeZones = onSchedule(ZONE_CHECK_SCHEDULE, async () => {
  const adapters = getAdapters();
  if (!adapters) return;

  const zones = await db.collectionGroup('safeZones').get();
  if (zones.empty) return;

  // At most ZONES_PER_MEMBER per member, oldest first. The app stops at the
  // limit; this is the backstop rules cannot be, since they cannot count.
  const byMember = new Map<string, QueryDocumentSnapshot[]>();
  for (const doc of zones.docs) {
    const key = `${doc.ref.parent.parent?.id}/${(doc.data() as StoredSafeZone).memberId}`;
    byMember.set(key, [...(byMember.get(key) ?? []), doc]);
  }
  const toCheck = [...byMember.values()].flatMap((docs) =>
    docs
      .sort((a, b) => (a.data() as StoredSafeZone).createdAt.toMillis() - (b.data() as StoredSafeZone).createdAt.toMillis())
      .slice(0, ZONES_PER_MEMBER),
  );

  const results = await Promise.allSettled(toCheck.map((doc) => checkZone(adapters, doc)));
  const failed = results.filter((r) => r.status === 'rejected').length;
  logger.info(`checkSafeZones: ${zones.size} zone(s), ${failed} failed`);
});

export async function checkZone(adapters: NetworkLocationAdapters, doc: QueryDocumentSnapshot): Promise<void> {
  const ownerRef = doc.ref.parent.parent;
  if (!ownerRef) return;
  const ownerId = ownerRef.id;
  const zone = doc.data() as StoredSafeZone;

  const [member, consentSnap] = await Promise.all([
    ownerRef.collection('basicPhoneMembers').doc(zone.memberId).get(),
    consentRef(ownerId, zone.memberId).get(),
  ]);
  const consent = consentSnap.data() as StoredConsent | undefined;
  // The gate, in Find's order. A zone for a member who stopped sharing is
  // simply not checked — and not audited, because nothing was asked.
  if (!member.exists || !consent || !allowsLocationLookup(consent.status)) return;
  if (!isMarketEnabled(marketForNumber(consent.phoneNumber))) return;

  let inside: boolean;
  const startedAt = Date.now();
  try {
    inside = await adapters.operator.verify(consent.phoneNumber, zone.centre, zone.radiusMeters);
  } catch (err) {
    metric('zone_check', { outcome: 'provider-error', latencyMs: Date.now() - startedAt, event: null, billedUnits: 1 });
    logger.warn('Zone verification failed', { failure: err instanceof OperatorError ? err.failure : 'unknown' });
    await writeAudit(ownerId, zone.memberId, 'geofence', 'provider-error', null);
    return;
  }
  await writeAudit(ownerId, zone.memberId, 'geofence', 'success', null);

  const event = await db.runTransaction(async (tx) => {
    const [fresh, latestConsent] = await Promise.all([tx.get(doc.ref), tx.get(consentRef(ownerId, zone.memberId))]);
    const current = fresh.data() as StoredSafeZone | undefined;
    // STOP wins even here: a reading taken before it landed reports nothing.
    if (!current || !allowsLocationLookup((latestConsent.data() as StoredConsent | undefined)?.status ?? 'REVOKED')) {
      return null;
    }

    const next = applyZoneReading(
      {
        state: current.state ?? 'unknown',
        pendingState: current.pendingState ?? null,
        pendingCount: current.pendingCount ?? 0,
      },
      inside,
    );
    const now = Timestamp.now();
    tx.update(doc.ref, {
      state: next.state,
      pendingState: next.pendingState,
      pendingCount: next.pendingCount,
      lastCheckedAt: now,
      ...(next.event ? { lastEventAt: now } : {}),
    });
    if (next.event) {
      tx.create(ownerRef.collection('zoneEvents').doc(), {
        zoneId: doc.id,
        memberId: zone.memberId,
        zoneName: current.name,
        event: next.event,
        at: now,
      });
    }
    return next.event;
  });

  metric('zone_check', { outcome: 'success', latencyMs: Date.now() - startedAt, event: event ?? null, billedUnits: 1 });
  if (event) {
    await tellGuardian(ownerId, (member.data() as StoredBasicPhoneMember).displayName, zone.name, event);
  }
}

async function tellGuardian(ownerId: string, memberName: string, zoneName: string, event: ZoneEvent) {
  const owner = await db.doc(`users/${ownerId}`).get();
  const token = (owner.data() as StoredUser | undefined)?.fcmToken?.trim();
  if (!token) return;
  // The guardian's own time zone — functions run in UTC, which would be an
  // hour wrong in a British summer and five and a half in India.
  const time = localTime(new Date(), marketForNumber((owner.data() as StoredUser | undefined)?.phone ?? ''));
  try {
    await messaging.send({
      token,
      notification: {
        // "reached", not "is safely at": the network says they are inside the
        // circle, which is all this can say.
        title: event === 'arrived' ? `${memberName} reached ${zoneName}` : `${memberName} left ${zoneName}`,
        body: `Around ${time}, from their mobile network — approximate.`,
      },
      data: { type: 'ZONE_EVENT', event, zoneName },
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (isDeadTokenError(code)) await owner.ref.update({ fcmToken: '' }).catch(() => {});
  }
}

/** Tells the member, once, that a zone now exists (see the `zone-created` template). */
export const onSafeZoneCreated = onDocumentCreated('users/{userId}/safeZones/{zoneId}', async (event) => {
  const zone = event.data?.data() as StoredSafeZone | undefined;
  if (!zone) return;
  const consent = (await consentRef(event.params.userId, zone.memberId).get()).data() as StoredConsent | undefined;
  if (!consent || !allowsLocationLookup(consent.status)) return;

  const adapters = getAdapters();
  if (!adapters) return;
  try {
    await sendMemberSms(
      adapters,
      consent.phoneNumber,
      'zone-created',
      await guardianNameFor(event.params.userId),
      { place: zone.name },
    );
  } catch (err) {
    logger.error('Zone-created SMS failed', { error: (err as Error).message });
  }
});
