import type { Coordinates } from './Journey';
import { haversineMeters } from './Place';

export type FamilyStatusType =
  /**
   * Not on a journey — all the publisher actually knows. Replaces `HOME` as
   * the default (Phase 5b): nothing checked the person was at home, and "At
   * home" in a safety app reads as "fine".
   */
  | 'IDLE'
  /** Legacy default; still readable on documents written before `IDLE`. */
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
  IDLE: 'Not on a journey',
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
 * A peer-to-peer safety connection between two wayLoc users.
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
  /** Live coarse position, gated by FamilyPermissions.shareLocation at publish time. */
  location: Coordinates | null;
  /** How far along the route they are. Null off a journey or without a route. */
  journeyProgress: JourneyProgress | null;
  /** The route, simplified to at most `MAX_SHARED_PATH_POINTS`. */
  routePath: Coordinates[] | null;
  /** When they last answered a check-in ("I'm OK"). Null if never, or unknown. */
  lastCheckInAt: Date | null;
  /** When the next check-in is due. Null when check-ins are off. */
  nextCheckInAt: Date | null;
  updatedAt: Date;
}

/**
 * Progress along a journey's route, computed on the traveller's own phone from
 * their own route — the only place both the route and a fresh position exist.
 */
export interface JourneyProgress {
  /** 0–1, along the route rather than as the crow flies. */
  fraction: number;
  metersRemaining: number;
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
  location: Coordinates | null;
  journeyProgress: JourneyProgress | null;
  routePath: Coordinates[] | null;
  lastCheckInAt: Date | null;
  nextCheckInAt: Date | null;
  /** When their shared status was last written — "updated 10 s ago". */
  updatedAt: Date | null;
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
  location: Coordinates | null;
  journeyProgress: JourneyProgress | null;
  routePath: Coordinates[] | null;
  lastCheckInAt: Date | null;
  nextCheckInAt: Date | null;
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
      location: null,
      journeyProgress: null,
      routePath: null,
      lastCheckInAt: null,
      nextCheckInAt: null,
    };
  }
  // Everything about the journey itself — how far along, which way, when they
  // last said they were OK — travels with the journey-details permission. The
  // route also needs location sharing: a route plus progress is a position.
  const journey = permissions.shareJourneyDetails;
  return {
    status: raw.status,
    batteryLevel: permissions.shareBattery ? raw.batteryLevel : null,
    lastSeen: raw.lastSeen,
    activeJourneyId: permissions.shareJourneyDetails ? raw.activeJourneyId : null,
    activeJourneyDestination: permissions.shareJourneyDetails ? raw.activeJourneyDestination : null,
    activeJourneyEta: permissions.shareJourneyDetails ? raw.activeJourneyEta : null,
    location: permissions.shareLocation ? raw.location : null,
    journeyProgress: journey && permissions.shareLocation ? raw.journeyProgress : null,
    routePath: journey && permissions.shareLocation ? raw.routePath : null,
    lastCheckInAt: journey ? raw.lastCheckInAt : null,
    nextCheckInAt: journey ? raw.nextCheckInAt : null,
  };
}

/** The most route points a shared status carries. Enough to draw; small to write. */
export const MAX_SHARED_PATH_POINTS = 40;

/**
 * A route thinned to at most `max` points, keeping both ends.
 *
 * Shared status is rewritten on every location update, so a full OSRM
 * geometry — often hundreds of points — would multiply every write for a line
 * that only has to be recognisable on a phone-sized map.
 */
export function simplifyPath(
  path: readonly Coordinates[],
  max: number = MAX_SHARED_PATH_POINTS,
): Coordinates[] {
  if (path.length <= max) return path.map(({ latitude, longitude }) => ({ latitude, longitude }));
  const step = (path.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => {
    const { latitude, longitude } = path[Math.round(i * step)];
    return { latitude, longitude };
  });
}

/**
 * How far along `path` someone at `position` is.
 *
 * Measured to the nearest route point, then along the route — not straight
 * line to the destination, which would read a long loop as nearly there.
 * Approximate by a point's spacing, which is all a progress bar needs. Null
 * when there is nothing honest to say: no position, or a route with no length.
 */
export function measureJourneyProgress(
  path: readonly Coordinates[],
  position: Coordinates | null,
): JourneyProgress | null {
  if (!position || path.length < 2) return null;

  const cumulative = [0];
  for (let i = 1; i < path.length; i++) {
    cumulative.push(cumulative[i - 1] + haversineMeters(path[i - 1], path[i]));
  }
  const total = cumulative[cumulative.length - 1];
  if (total <= 0) return null;

  let nearest = 0;
  let nearestDistance = Infinity;
  path.forEach((point, i) => {
    const d = haversineMeters(point, position);
    if (d < nearestDistance) {
      nearestDistance = d;
      nearest = i;
    }
  });

  return {
    fraction: cumulative[nearest] / total,
    metersRemaining: Math.round(total - cumulative[nearest]),
  };
}

// ─── Watch presence (Phase 5b step 4) ──────────────────────────────────────────

/**
 * Someone with Watch live open on a member (S2c). The watched person sees who
 * (decision F4: by name — it is their location).
 */
export interface Watcher {
  watcherId: string;
  name: string;
  /** The member being watched. */
  watching: string;
  /** Presence lapses by itself at this time unless refreshed. */
  until: Date;
}

/**
 * How long one announcement of watching lasts. Refreshed while the screen is
 * open and deleted when it closes; the expiry is for when neither happens — a
 * crash, a dead battery — so nobody is shown as "watching" forever.
 */
export const WATCH_PRESENCE_TTL_MS = 2 * 60 * 1_000;

/** How often an open Watch live screen re-announces itself. */
export const WATCH_HEARTBEAT_MS = 60 * 1_000;

/** Watchers still present at `now`, by name, each person once. */
export function presentWatchers(watchers: readonly Watcher[], now: Date): Watcher[] {
  const seen = new Set<string>();
  return watchers.filter((w) => {
    if (w.until.getTime() <= now.getTime() || seen.has(w.watcherId)) return false;
    seen.add(w.watcherId);
    return true;
  });
}

/** "Mum is watching", "Mum and Alex are watching", "Mum and 2 others are watching". */
export function describeWatchers(watchers: readonly Watcher[]): string | null {
  if (watchers.length === 0) return null;
  if (watchers.length === 1) return `${watchers[0].name} is watching`;
  if (watchers.length === 2) return `${watchers[0].name} and ${watchers[1].name} are watching`;
  return `${watchers[0].name} and ${watchers.length - 1} others are watching`;
}

/** What happened when a watcher tapped Ask "OK?" (S2c). */
export type AskOkOutcome = 'sent' | 'no-device' | 'too-soon' | 'not-travelling' | 'failed';
