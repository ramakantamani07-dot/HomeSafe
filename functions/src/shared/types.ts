import type { Timestamp } from 'firebase-admin/firestore';

/**
 * Firestore document shapes, mirroring the client-side models in `src/models/`.
 *
 * Deliberately duplicated rather than imported: `functions/` is a separate
 * TypeScript project with its own tsconfig and dependency tree, and shares no
 * module graph with the app. Keep these in sync by hand when a stored shape
 * changes — a shared package would cost more than it saves at this size.
 */

export interface StoredSOS {
  userId: string;
  journeyId: string | null;
  location: { latitude: number; longitude: number } | null;
  status: 'ACTIVE' | 'RESOLVED';
  triggeredAt: Timestamp;
}

export interface StoredJourney {
  status: string;
  destinationLabel: string;
  /** Latest tracked position. Absent until the first location update lands. */
  currentLocation?: { latitude: number; longitude: number };
}

export interface StoredContact {
  name: string;
  phone: string;
}

export interface StoredUser {
  name?: string;
  phone?: string;
  fcmToken?: string;
}

export interface StoredSafetyCheck {
  journeyId: string;
  reason: 'late' | 'stopped' | 'off-route';
  status: 'PENDING' | 'CONFIRMED' | 'EXTENDED' | 'ESCALATED';
  raisedAt: Timestamp;
  escalatedAt: Timestamp | null;
  location: { latitude: number; longitude: number } | null;
  batteryPercent: number | null;
}

// FCM data values must all be strings.
export interface AlertData {
  type: 'SOS_TRIGGERED' | 'MISSED_CHECKIN' | 'SAFETY_CHECK_ESCALATED';
  userId: string;
  userName: string;
  journeyId: string;
  timestamp: string;
  location: string; // "lat,lng" or "" when unknown
  /** Present only on SAFETY_CHECK_ESCALATED. "" when the battery is unknown. */
  battery?: string;
}

// ── Network location (mirrors src/models/Consent.ts, LocateAudit.ts) ────────

export interface StoredConsent {
  memberId: string;
  status:
    | 'PENDING_SMS'
    | 'SMS_APPROVED'
    | 'OPERATOR_PENDING'
    | 'ACTIVE'
    | 'DECLINED'
    | 'EXPIRED'
    | 'REVOKED';
  phoneNumber: string;
  requestedAt: Timestamp;
  expiresAt: Timestamp;
  activatedAt: Timestamp | null;
  updatedAt: Timestamp;
  // Server-only fields below. The rules refuse them on a client create, so a
  // guardian cannot pre-set the throttle or the rate-limit history.
  /** Delivery of the consent-request text. */
  requestSms?: { status: 'sending' | 'sent' | 'failed' | 'unavailable'; at: Timestamp };
  /** Permitted lookups in the last hour — the rate-limit window, kept bounded. */
  recentLookupsAt?: Timestamp[];
  /** When the member was last told someone looked them up. */
  lastNoticeAt?: Timestamp | null;
  /**
   * Who revoked, when the server did. Absent on a REVOKED consent means the
   * guardian's own device wrote it — the rules let a client change nothing but
   * `status` and `updatedAt`, so a client cannot claim to be anyone else.
   */
  revokedBy?: string;
  /** Each time the guardian resent the request — bounded by the resend limit. */
  resendsAt?: Timestamp[];
  /** Set once the revocation's side effects have run, so they run once. */
  revocationHandledAt?: Timestamp;
}

export interface StoredBasicPhoneMember {
  displayName: string;
  phoneNumber: string;
  consentStatus: StoredConsent['status'];
}

// ── Family (mirrors src/models/Family.ts) ───────────────────────────────────

export interface StoredFamilyConnection {
  user1Id: string;
  user2Id: string;
  status: 'PENDING' | 'ACTIVE' | 'DECLINED' | 'CANCELLED';
}

/** The already-filtered view one member publishes into a connection. */
export interface StoredSharedStatus {
  status: string | null;
}

// ── Safe zones (mirrors src/models/SafeZone.ts) ─────────────────────────────

export interface StoredSafeZone {
  memberId: string;
  name: string;
  centre: { latitude: number; longitude: number };
  radiusMeters: number;
  createdAt: Timestamp;
  // Server-only — the rules refuse them from a client.
  state?: 'inside' | 'outside' | 'unknown';
  pendingState?: 'inside' | 'outside' | null;
  pendingCount?: number;
  lastCheckedAt?: Timestamp | null;
  lastEventAt?: Timestamp | null;
}
