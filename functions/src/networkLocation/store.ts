import { Timestamp, type DocumentReference } from 'firebase-admin/firestore';

import { db } from '../shared/firebase';
import { metric } from '../shared/metrics';
import type { StoredConsent } from '../shared/types';
import {
  applyConsentEvent,
  type ConsentEventKind,
  type ConsentTransition,
  type ConsentTrigger,
} from './consent';

/**
 * The one way the server changes a consent.
 *
 * Status, audit event and the member's mirrored status are written in a single
 * transaction, so they cannot disagree: there is no moment at which a consent
 * is ACTIVE without the event saying why, or the circle list shows a member as
 * findable after they texted STOP.
 *
 * The transition is decided inside the transaction against the state as it is
 * *now*, not as the caller last read it. A STOP that lands while an operator
 * approval is in flight therefore wins: the approval finds REVOKED, the state
 * machine refuses it, and nothing is written.
 */
export async function transitionConsent(
  consentRef: DocumentReference,
  event: ConsentEventKind,
  note: string | null,
  trigger?: ConsentTrigger,
): Promise<ConsentTransition | null> {
  const ownerRef = consentRef.parent.parent;
  if (!ownerRef) throw new Error('Consent is not under a user');

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(consentRef);
    if (!snap.exists) return null;
    const consent = snap.data() as StoredConsent;

    const memberRef = ownerRef.collection('basicPhoneMembers').doc(consent.memberId);
    const member = await tx.get(memberRef);

    const transition = applyConsentEvent(consent.status, event, trigger);
    if (!transition) return null;

    const now = Timestamp.now();
    tx.update(consentRef, {
      status: transition.to,
      updatedAt: now,
      ...(transition.to === 'ACTIVE' ? { activatedAt: now } : {}),
      ...(transition.to === 'REVOKED' ? { revokedBy: transition.trigger } : {}),
    });
    tx.create(ownerRef.collection('consentEvents').doc(), {
      memberId: consent.memberId,
      from: transition.from,
      to: transition.to,
      trigger: transition.trigger,
      note,
      at: now,
    });
    // Only if the member still exists — a guardian may delete the member while
    // the consent record stays as evidence, and recreating a half-document
    // here would bring a deleted person back into their circle.
    if (member.exists) tx.update(memberRef, { consentStatus: transition.to });

    return transition;
  }).then((transition) => {
    // Counted after the commit, so a retried transaction is counted once.
    if (transition) metric('consent_transition', { from: transition.from, to: transition.to, trigger: transition.trigger });
    return transition;
  });
}

export function consentRef(ownerId: string, memberId: string): DocumentReference {
  return db.doc(`users/${ownerId}/consents/${memberId}`);
}

/** The consent's owner — the guardian who asked. */
export function ownerIdOf(ref: DocumentReference): string {
  const owner = ref.parent.parent;
  if (!owner) throw new Error('Consent is not under a user');
  return owner.id;
}
