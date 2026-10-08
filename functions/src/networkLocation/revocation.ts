import * as logger from 'firebase-functions/logger';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { Timestamp } from 'firebase-admin/firestore';

import { db } from '../shared/firebase';
import type { StoredConsent } from '../shared/types';
import { getAdapters } from './adapters';
import { guardianNameFor, sendMemberSms } from './memberSms';
import { planRevocation } from './planning';

/**
 * Revocation layer 3: the side effects of a consent reaching REVOKED.
 *
 * **The permission change has already happened** by the time this runs — that
 * is the point of the split. Layer 2 (the guardian's tap) is a client write,
 * and layer 1 (the member's STOP) is the webhook's. Both flip the document,
 * and lookups are gated on it. This function only tidies up afterwards, so it
 * is allowed to be late, and to retry.
 *
 * **A trigger rather than a callable.** A guardian offline when they tap "Stop
 * finding" has their write queued by Firestore's own offline persistence; this
 * fires the moment it syncs. A callable would need a second queue to survive
 * the same case, and could be skipped by a client that wrote REVOKED without
 * calling it. Firing on the write also means every revocation — tap, STOP,
 * account deletion — has its cleanup in one place (ARCHITECTURE §6).
 *
 * Claimed once via `revocationHandledAt`, because triggers are delivered at
 * least once and the member should not be texted twice.
 *
 * TODO(6.5, G3): delete operator-side geofences and revoke the operator token
 * here, once either exists. In-flight lookups need nothing: `locate` re-reads
 * consent after the operator answers and discards the fix (D21).
 */
export const onConsentRevoked = onDocumentUpdated(
  'users/{userId}/consents/{memberId}',
  async (event) => {
    const before = event.data?.before.data() as StoredConsent | undefined;
    const after = event.data?.after.data() as StoredConsent | undefined;
    if (!before || !after) return;
    if (before.status === 'REVOKED' || after.status !== 'REVOKED') return;

    const ref = event.data!.after.ref;
    const { userId } = event.params;

    const claimed = await db.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data() as StoredConsent | undefined;
      if (!current || current.revocationHandledAt) return null;
      // Read before any write — a transaction refuses reads after writes.
      const memberRef = db.doc(`users/${userId}/basicPhoneMembers/${current.memberId}`);
      const member = await tx.get(memberRef);

      const now = Timestamp.now();
      const plan = planRevocation(current.revokedBy, current.requestSms?.status === 'sent');
      tx.update(ref, { revocationHandledAt: now });

      if (plan.writeEvent) {
        tx.create(db.collection(`users/${userId}/consentEvents`).doc(), {
          memberId: current.memberId,
          from: before.status,
          to: 'REVOKED',
          trigger: 'guardian-removed',
          note: 'stopped from the app',
          at: now,
        });
        // The circle list's mirror. The server-side paths keep it in step
        // themselves; a client write may not have.
        if (member.exists) tx.update(memberRef, { consentStatus: 'REVOKED' });
      }
      return { plan, phoneNumber: current.phoneNumber };
    });
    if (!claimed?.plan.notify) return;

    const adapters = getAdapters();
    if (!adapters) return;
    try {
      await sendMemberSms(adapters, claimed.phoneNumber, claimed.plan.notify, await guardianNameFor(userId));
    } catch (err) {
      logger.error('Revocation notice SMS failed', { error: (err as Error).message });
    }
  },
);
