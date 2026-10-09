import {
  collection,
  addDoc,
  deleteDoc,
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
import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import type { FirebaseApp } from 'firebase/app';

import type { BasicPhoneMember, NewBasicPhoneMember } from '../../models/BasicPhoneMember';
import {
  CONSENT_REQUEST_TTL_MS,
  type Consent,
  type ConsentRequestDelivery,
  type ConsentStatus,
  type ResendOutcome,
} from '../../models/Consent';
import type { LocateAudit, LocateOutcome, LocateReason } from '../../models/LocateAudit';
import type { NewSafeZone, SafeZone, ZoneState } from '../../models/SafeZone';
import type { MemberEvent } from '../../models/MemberEvent';
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

type StoredZone = {
  memberId: string;
  name: string;
  centre: { latitude: number; longitude: number };
  radiusMeters: number;
  createdAt: Timestamp;
  state?: ZoneState;
  lastCheckedAt?: Timestamp | null;
  lastEventAt?: Timestamp | null;
};

/** How many of a member's SOS and check-ins the screen lists. */
const MEMBER_EVENTS_SHOWN = 20;

/**
 * Basic-phone members on Firestore, under `users/{uid}/` — see firestore.rules
 * for what each document allows. The rules, not this file, are what stop a
 * client reaching any consent state but PENDING_SMS and REVOKED.
 */
export class FirebaseBasicPhoneMemberProvider implements BasicPhoneMemberProvider {
  private readonly db: Firestore;
  private readonly functions: Functions;

  constructor(app: FirebaseApp) {
    this.db = getFirestore(app);
    this.functions = getFunctions(app);
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

  async resendRequest(_ownerId: string, memberId: string): Promise<ResendOutcome> {
    try {
      const call = httpsCallable<{ memberId: string }, { delivery: ConsentRequestDelivery }>(
        this.functions,
        'resendConsentRequest',
      );
      const { data } = await call({ memberId });
      return data.delivery === 'sent' ? 'sent' : 'not-sent';
    } catch (err) {
      const refusal = (err as { details?: { refusal?: string } }).details?.refusal;
      return refusal === 'too-soon' || refusal === 'limit-reached' || refusal === 'not-pending'
        ? refusal
        : 'failed';
    }
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

  subscribeZones(ownerId: string, memberId: string, onChange: (zones: SafeZone[]) => void): Unsubscribe {
    return onSnapshot(
      query(collection(this.db, 'users', ownerId, 'safeZones'), where('memberId', '==', memberId)),
      (snap) =>
        onChange(
          snap.docs
            .map((d) => {
              const z = d.data() as StoredZone;
              return {
                id: d.id,
                memberId: z.memberId,
                name: z.name,
                centre: z.centre,
                radiusMeters: z.radiusMeters,
                state: z.state ?? 'unknown',
                lastCheckedAt: z.lastCheckedAt?.toDate() ?? null,
                lastEventAt: z.lastEventAt?.toDate() ?? null,
                createdAt: z.createdAt?.toDate() ?? new Date(),
              } satisfies SafeZone;
            })
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
        ),
      () => {},
    );
  }

  async addZone(ownerId: string, zone: NewSafeZone): Promise<void> {
    await addDoc(collection(this.db, 'users', ownerId, 'safeZones'), {
      memberId: zone.memberId,
      name: zone.name.trim(),
      centre: { latitude: zone.centre.latitude, longitude: zone.centre.longitude },
      radiusMeters: zone.radiusMeters,
      createdAt: Timestamp.now(),
    });
  }

  async deleteZone(ownerId: string, zoneId: string): Promise<void> {
    await deleteDoc(doc(this.db, 'users', ownerId, 'safeZones', zoneId));
  }

  subscribeEvents(ownerId: string, memberId: string, onChange: (events: MemberEvent[]) => void): Unsubscribe {
    return onSnapshot(
      query(
        collection(this.db, 'users', ownerId, 'memberEvents'),
        where('memberId', '==', memberId),
        orderBy('at', 'desc'),
        limitTo(MEMBER_EVENTS_SHOWN),
      ),
      (snap) =>
        onChange(
          snap.docs.map((d) => {
            const e = d.data() as Omit<MemberEvent, 'id' | 'at'> & { at: Timestamp };
            return {
              id: d.id,
              memberId: e.memberId,
              kind: e.kind,
              source: e.source,
              label: e.label ?? null,
              at: e.at.toDate(),
              location: e.location ?? null,
              accuracyMeters: e.accuracyMeters ?? null,
              failure: e.failure ?? null,
            };
          }),
        ),
      () => {},
    );
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
