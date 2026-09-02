export type FamilyStatusType =
  | 'HOME'
  | 'TRAVELLING'
  | 'ARRIVED'
  | 'AT_WORK'
  | 'AT_SCHOOL'
  | 'SHOPPING'
  | 'OFFLINE'
  | 'SOS_ACTIVE';

export type SharingMode =
  | 'SHARE_ALWAYS'
  | 'SHARE_DURING_JOURNEY'
  | 'NEVER_SHARE'
  | 'SHARE_WITH_SELECTED';

export const SHARING_MODE_LABELS: Record<SharingMode, string> = {
  SHARE_ALWAYS: 'Share always',
  SHARE_DURING_JOURNEY: 'Share during journeys only',
  NEVER_SHARE: 'Never share',
  SHARE_WITH_SELECTED: 'Share with selected members',
};

export const FAMILY_STATUS_LABELS: Record<FamilyStatusType, string> = {
  HOME: 'Home',
  TRAVELLING: 'Travelling',
  ARRIVED: 'Arrived',
  AT_WORK: 'At Work',
  AT_SCHOOL: 'At School',
  SHOPPING: 'Shopping',
  OFFLINE: 'Offline',
  SOS_ACTIVE: 'SOS Active',
};

export const FAMILY_RELATIONSHIPS = [
  'Parent',
  'Child',
  'Spouse',
  'Partner',
  'Sibling',
  'Grandparent',
  'Grandchild',
  'Other',
] as const;

export type FamilyRelationship = (typeof FAMILY_RELATIONSHIPS)[number];

export interface FamilyPermissions {
  sharingMode: SharingMode;
  shareLocation: boolean;
  shareJourneyDetails: boolean;
  shareBattery: boolean;
  shareStatus: boolean;
}

export function defaultFamilyPermissions(): FamilyPermissions {
  return {
    sharingMode: 'SHARE_DURING_JOURNEY',
    shareLocation: true,
    shareJourneyDetails: true,
    shareBattery: true,
    shareStatus: true,
  };
}

export type FamilyConnectionStatus = 'PENDING' | 'ACTIVE' | 'DECLINED' | 'CANCELLED';

/**
 * A peer-to-peer safety connection between two HomeSafe users.
 * connectionId is always min(uid1, uid2) + '_' + max(uid1, uid2) so it is
 * deterministic and there is exactly one document per pair.
 */
export interface FamilyConnection {
  id: string;
  user1Id: string;
  user2Id: string;
  user1DisplayName: string;
  user2DisplayName: string;
  user1Phone: string;
  user2Phone: string;
  relationship: string;
  status: FamilyConnectionStatus;
  initiatedBy: string;
  /** What user1 shares with user2 */
  user1Permissions: FamilyPermissions;
  /** What user2 shares with user1 */
  user2Permissions: FamilyPermissions;
  createdAt: Date;
  updatedAt: Date;
}

/** Pending invitation to join as a family connection. */
export interface FamilyInvitation {
  id: string;
  fromUserId: string;
  fromDisplayName: string;
  fromPhone: string;
  toPhone: string;
  relationship: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';
  createdAt: Date;
  expiresAt: Date;
}

/** Live safety status snapshot published to Firestore by each user. */
export interface FamilyStatusSnapshot {
  userId: string;
  status: FamilyStatusType;
  batteryLevel: number | null;
  lastSeen: Date;
  activeJourneyId: string | null;
  activeJourneyDestination: string | null;
  activeJourneyEta: Date | null;
  updatedAt: Date;
}

/** A family connection resolved into a display-ready member object. */
export interface FamilyMember {
  /** The other user's userId */
  id: string;
  connectionId: string;
  displayName: string;
  phoneNumber: string;
  relationship: string;
  connectionStatus: FamilyConnectionStatus;
  /** What they share with me */
  theirPermissions: FamilyPermissions;
  /** What I share with them */
  myPermissions: FamilyPermissions;
  // Live status — only populated when they share and we have fetched their snapshot
  status: FamilyStatusType;
  batteryLevel: number | null;
  lastSeen: Date | null;
  activeJourneyId: string | null;
  activeJourneyDestination: string | null;
  activeJourneyEta: Date | null;
}

export const INVITATION_EXPIRY_DAYS = 7;

export function computeConnectionId(uid1: string, uid2: string): string {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

export function statusAllowedBy(permissions: FamilyPermissions, hasActiveJourney: boolean): boolean {
  const mode = permissions.sharingMode;
  if (mode === 'NEVER_SHARE') return false;
  if (mode === 'SHARE_ALWAYS') return permissions.shareStatus;
  if (mode === 'SHARE_DURING_JOURNEY') return hasActiveJourney && permissions.shareStatus;
  return permissions.shareStatus;
}

/**
 * The permission-filtered subset of a status snapshot that a single connection
 * is allowed to see. This is computed once at publish time (see
 * `deriveSharedView`) and stored per-connection, so Firestore rules only need
 * to check connection membership — they never need to reason about individual
 * sharing toggles, because a doc a viewer can read already contains only what
 * they're allowed to see.
 */
export interface SharedFamilyView {
  status: FamilyStatusType | null;
  batteryLevel: number | null;
  lastSeen: Date | null;
  activeJourneyId: string | null;
  activeJourneyDestination: string | null;
  activeJourneyEta: Date | null;
}

/**
 * Applies one connection's outbound permissions to a raw status snapshot,
 * producing exactly the view that connection is allowed to see.
 * `status: null` signals "nothing shared" — the reader should treat this the
 * same as no snapshot existing at all.
 */
export function deriveSharedView(
  raw: Omit<FamilyStatusSnapshot, 'userId'>,
  permissions: FamilyPermissions,
): SharedFamilyView {
  const hasActiveJourney = raw.activeJourneyId != null;
  if (!statusAllowedBy(permissions, hasActiveJourney)) {
    return {
      status: null,
      batteryLevel: null,
      lastSeen: null,
      activeJourneyId: null,
      activeJourneyDestination: null,
      activeJourneyEta: null,
    };
  }
  return {
    status: raw.status,
    batteryLevel: permissions.shareBattery ? raw.batteryLevel : null,
    lastSeen: raw.lastSeen,
    activeJourneyId: permissions.shareJourneyDetails ? raw.activeJourneyId : null,
    activeJourneyDestination: permissions.shareJourneyDetails ? raw.activeJourneyDestination : null,
    activeJourneyEta: permissions.shareJourneyDetails ? raw.activeJourneyEta : null,
  };
}
