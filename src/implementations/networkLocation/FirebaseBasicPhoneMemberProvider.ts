import {
  collection,
  doc,
  getDocs,
  getFirestore,
  limit as limitTo,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';

import type { BasicPhoneMember, NewBasicPhoneMember } from '../../models/BasicPhoneMember';
import {
  CONSENT_REQUEST_TTL_MS,
  type Consent,
  type ConsentRequestDelivery,
  type ConsentStatus,
} from '../../models/Consent';
import type { LocateAudit, LocateOutcome, LocateReason } from '../../models/LocateAudit';
import type { BasicPhoneMemberProvider } from '../../providers/BasicPhoneMemberProvider';
import type { Unsubscribe } from '../../providers/types';

type StoredMember = {
  displayName: string;
  phoneNumber: string;
  operator: string | null;
  consentStatus: ConsentStatus;
  minor: boolean;
  guardianAttestedAt: Timestamp | null;
  createdAt: Timestamp;
};

type StoredConsent = {
  memberId: string;
  status: ConsentStatus;
  phoneNumber: string;
  requestedAt: Timestamp;
  expiresAt: Timestamp;
  activatedAt: Timestamp | null;
  updatedAt: Timestamp;
  requestSms?: { status: ConsentRequestDelivery };
};

type StoredAudit = {
  memberId: string;
  requestedBy: string;
  reason: LocateReason;
  outcome: LocateOutcome;
  location: { latitude: number; longitude: number } | null;
  accuracyMeters: number | null;
  at: Timestamp;
};

/**
 * Basic-phone members on Firestore, under `users/{uid}/` — see firestore.rules
 * for what each document allows. The rules, not this file, are what stop a
 * client reaching any consent state but PENDING_SMS and REVOKED.
 */
export class FirebaseBasicPhoneMemberProvider implements BasicPhoneMemberProvider {
  private readonly db: Firestore;

  constructor(app: FirebaseApp) {
    this.db = getFirestore(app);
  }

  subscribeMembers(ownerId: string, onChange: (members: BasicPhoneMember[]) => void): Unsubscribe {
    return onSnapshot(
      query(collection(this.db, 'users', ownerId, 'basicPhoneMembers'), orderBy('createdAt')),
      (snap) => onChange(snap.docs.map((d) => toMember(ownerId, d.id, d.data() as StoredMember))),
      // A failed listener leaves the last good list in place rather than
      // blanking the circle — an empty list would read as "no one to find".
      () => {},
    );
  }

  async addMember(ownerId: string, input: NewBasicPhoneMember): Promise<BasicPhoneMember> {
    const memberRef = doc(collection(this.db, 'users', ownerId, 'basicPhoneMembers'));
    const now = Timestamp.now();

    const member: StoredMember = {
      displayName: input.displayName.trim(),
      phoneNumber: input.phoneNumber,
      operator: null,
      consentStatus: 'PENDING_SMS',
      minor: input.minor,
      guardianAttestedAt: input.minor && input.guardianAttested ? now : null,
      createdAt: now,
    };
    // Keyed by the member's id: one consent per member, and a re-ask after a
    // refusal is a new member record rather than a rewritten consent.
    const consent: Omit<StoredConsent, 'requestSms'> = {
      memberId: memberRef.id,
      status: 'PENDING_SMS',
      phoneNumber: input.phoneNumber,
      requestedAt: now,
      // Advisory: the server resets it from its own clock when it sends.
      expiresAt: Timestamp.fromMillis(now.toMillis() + CONSENT_REQUEST_TTL_MS),
      activatedAt: null,
      updatedAt: now,
    };

    const batch = writeBatch(this.db);
    batch.set(memberRef, member);
    batch.set(doc(this.db, 'users', ownerId, 'consents', memberRef.id), consent);
    await batch.commit();

    return toMember(ownerId, memberRef.id, member);
  }

  subscribeConsent(
    ownerId: string,
    memberId: string,
    onChange: (consent: Consent | null) => void,
  ): Unsubscribe {
    return onSnapshot(
      doc(this.db, 'users', ownerId, 'consents', memberId),
      (snap) => onChange(snap.exists() ? toConsent(snap.data() as StoredConsent) : null),
      () => {},
    );
  }

  async stopFinding(ownerId: string, memberId: string): Promise<void> {
    const batch = writeBatch(this.db);
    batch.update(doc(this.db, 'users', ownerId, 'consents', memberId), {
      status: 'REVOKED',
      updatedAt: serverTimestamp(),
    });
    // The mirror too, so the circle list changes at once even offline. The
    // server would correct it on sync anyway.
    batch.update(doc(this.db, 'users', ownerId, 'basicPhoneMembers', memberId), {
      consentStatus: 'REVOKED',
    });
    // Not awaited past the local write: a queued write is already in effect
    // locally, and waiting for the server would make "Stop" depend on signal.
    batch.commit().catch(() => {});
  }

  async listFinds(ownerId: string, memberId: string, limit: number): Promise<LocateAudit[]> {
    const snap = await getDocs(
      query(
        collection(this.db, 'users', ownerId, 'locateAudits'),
        where('memberId', '==', memberId),
        orderBy('at', 'desc'),
        limitTo(limit),
      ),
    );
    return snap.docs.map((d) => {
      const a = d.data() as StoredAudit;
      return {
        id: d.id,
        memberId: a.memberId,
        requestedBy: a.requestedBy,
        reason: a.reason,
        outcome: a.outcome,
        location: a.location,
        accuracyMeters: a.accuracyMeters,
        at: a.at.toDate(),
      };
    });
  }
}

function toMember(ownerId: string, id: string, m: StoredMember): BasicPhoneMember {
  return {
    id,
    ownerId,
    displayName: m.displayName,
    phoneNumber: m.phoneNumber,
    operator: m.operator ?? null,
    consentStatus: m.consentStatus,
    minor: m.minor ?? false,
    guardianAttestedAt: m.guardianAttestedAt?.toDate() ?? null,
    createdAt: m.createdAt?.toDate() ?? new Date(),
  };
}

function toConsent(c: StoredConsent): Consent {
  return {
    memberId: c.memberId,
    status: c.status,
    phoneNumber: c.phoneNumber,
    requestedAt: c.requestedAt.toDate(),
    expiresAt: c.expiresAt.toDate(),
    activatedAt: c.activatedAt?.toDate() ?? null,
    // A pending server timestamp reads as null in the local snapshot.
    updatedAt: c.updatedAt?.toDate() ?? new Date(),
    requestDelivery: c.requestSms?.status ?? null,
  };
}
