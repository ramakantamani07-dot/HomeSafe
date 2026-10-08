import type { FamilyProvider } from '../providers/FamilyProvider';
import type {
  FamilyConnection,
  FamilyInvitation,
  FamilyMember,
  FamilyPermissions,
  FamilyStatusSnapshot,
  FamilyStatusType,
  AskOkOutcome,
  SharedFamilyView,
  Watcher,
} from '../models/Family';
import {
  computeConnectionId,
  deriveSharedView,
  WATCH_PRESENCE_TTL_MS,
  measureJourneyProgress,
  simplifyPath,
} from '../models/Family';
import type { Coordinates } from '../models/Journey';

const E164_REGEX = /^\+[1-9]\d{6,14}$/;
const OFFLINE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export interface PublishStatusInput {
  activeJourneyId: string | null;
  activeJourneyDestination: string | null;
  activeJourneyEta: Date | null;
  activeSosId: string | null;
  batteryLevel: number | null;
  location: Coordinates | null;
  /** The live route's full geometry, when a journey has one. */
  routePath: readonly Coordinates[] | null;
  lastCheckInAt: Date | null;
  nextCheckInAt: Date | null;
}

/** The live part of a FamilyMember — everything that comes from their shared view. */
export type MemberStatusFields = Omit<
  FamilyMember,
  | 'id'
  | 'connectionId'
  | 'displayName'
  | 'phoneNumber'
  | 'relationship'
  | 'connectionStatus'
  | 'theirPermissions'
  | 'myPermissions'
>;

/**
 * A member's status as a viewer may show it.
 *
 * The view was already filtered by the member's own permissions at publish
 * time, so the only questions here are whether anything was shared at all and
 * whether it is too old to stand behind. A stale view keeps its timestamps —
 * "last seen 40 min ago" is true — but drops position and progress, which
 * would no longer be.
 */
export function memberStatusFromView(
  view: SharedFamilyView | null,
  now: Date,
): MemberStatusFields {
  const wasShared = view !== null && view.status !== null;
  const isStale =
    wasShared && view!.lastSeen !== null && now.getTime() - view!.lastSeen.getTime() > OFFLINE_THRESHOLD_MS;

  return {
    status: !wasShared || isStale ? 'OFFLINE' : view!.status!,
    batteryLevel: wasShared ? view!.batteryLevel : null,
    lastSeen: wasShared ? view!.lastSeen : null,
    activeJourneyId: wasShared ? view!.activeJourneyId : null,
    activeJourneyDestination: wasShared ? view!.activeJourneyDestination : null,
    activeJourneyEta: wasShared ? view!.activeJourneyEta : null,
    location: wasShared && !isStale ? view!.location : null,
    journeyProgress: wasShared && !isStale ? view!.journeyProgress : null,
    routePath: wasShared && !isStale ? view!.routePath : null,
    lastCheckInAt: wasShared ? view!.lastCheckInAt : null,
    nextCheckInAt: wasShared ? view!.nextCheckInAt : null,
    updatedAt: wasShared ? view!.lastSeen : null,
  };
}

function deriveStatus(
  input: PublishStatusInput,
  previouslyTravelling: boolean,
  journeyJustCompleted: boolean,
): FamilyStatusType {
  if (input.activeSosId) return 'SOS_ACTIVE';
  if (input.activeJourneyId) return 'TRAVELLING';
  if (journeyJustCompleted && previouslyTravelling) return 'ARRIVED';
  // Not "HOME": nothing here knows where they are, only that no journey is on.
  return 'IDLE';
}

export class FamilyService {
  constructor(private readonly provider: FamilyProvider) {}

  // ─── Invitations ────────────────────────────────────────────────────────────

  async inviteMember(
    fromUserId: string,
    fromDisplayName: string,
    fromPhone: string,
    toPhone: string,
    relationship: string,
  ): Promise<FamilyInvitation> {
    const phone = toPhone.trim();

    if (!E164_REGEX.test(phone)) {
      throw new Error(
        'Enter a valid phone number with country code (e.g. +919876543210).',
      );
    }

    if (phone === fromPhone) {
      throw new Error('You cannot invite yourself.');
    }

    if (!relationship.trim()) {
      throw new Error('Relationship is required.');
    }

    // Check for existing connection
    const existing = await this.provider.getConnectionsForUser(fromUserId);
    const alreadyConnected = existing.some(
      (c) =>
        c.status === 'ACTIVE' &&
        (c.user1Phone === phone || c.user2Phone === phone),
    );
    if (alreadyConnected) {
      throw new Error('You are already connected with this person.');
    }

    return this.provider.createInvitation({
      fromUserId,
      fromDisplayName,
      fromPhone,
      toPhone: phone,
      relationship,
    });
  }

  async cancelInvitation(invitationId: string): Promise<void> {
    await this.provider.updateInvitationStatus(invitationId, 'CANCELLED');
  }

  async getPendingInvitations(userPhone: string): Promise<FamilyInvitation[]> {
    const invitations = await this.provider.getPendingInvitationsForPhone(userPhone);
    const now = new Date();
    const valid: FamilyInvitation[] = [];
    for (const inv of invitations) {
      if (inv.expiresAt < now) {
        // Mark expired without blocking the caller
        this.provider.updateInvitationStatus(inv.id, 'EXPIRED').catch(() => {});
      } else {
        valid.push(inv);
      }
    }
    return valid;
  }

  async getSentInvitations(userId: string): Promise<FamilyInvitation[]> {
    return this.provider.getSentInvitations(userId);
  }

  // ─── Accept / decline ────────────────────────────────────────────────────────

  async acceptInvitation(
    invitationId: string,
    currentUserId: string,
    currentDisplayName: string,
    currentPhone: string,
  ): Promise<FamilyConnection> {
    const invitations = await this.provider.getPendingInvitationsForPhone(currentPhone);
    const invitation = invitations.find((i) => i.id === invitationId);

    if (!invitation) {
      throw new Error('Invitation not found or no longer pending.');
    }
    if (invitation.expiresAt < new Date()) {
      await this.provider.updateInvitationStatus(invitationId, 'EXPIRED');
      throw new Error('This invitation has expired.');
    }

    // Check if connection already exists (idempotent accept)
    const connectionId = computeConnectionId(invitation.fromUserId, currentUserId);
    const existing = await this.provider.getConnectionsForUser(currentUserId);
    const alreadyActive = existing.find(
      (c) => c.id === connectionId && c.status === 'ACTIVE',
    );
    if (alreadyActive) return alreadyActive;

    const connection = await this.provider.createConnection({
      invitationId,
      fromUserId: invitation.fromUserId,
      fromDisplayName: invitation.fromDisplayName,
      fromPhone: invitation.fromPhone,
      fromRelationship: invitation.relationship,
      toUserId: currentUserId,
      toDisplayName: currentDisplayName,
      toPhone: currentPhone,
    });

    await this.provider.updateInvitationStatus(invitationId, 'ACCEPTED');
    return connection;
  }

  async declineInvitation(invitationId: string): Promise<void> {
    await this.provider.updateInvitationStatus(invitationId, 'DECLINED');
  }

  // ─── Members ─────────────────────────────────────────────────────────────────

  async getFamilyMembers(userId: string): Promise<FamilyMember[]> {
    const connections = await this.provider.getConnectionsForUser(userId);
    const activeConnections = connections.filter((c) => c.status === 'ACTIVE');

    const members = await Promise.all(
      activeConnections.map(async (conn) => {
        const isUser1 = conn.user1Id === userId;
        const memberId = isUser1 ? conn.user2Id : conn.user1Id;
        const theirPermissions = isUser1 ? conn.user2Permissions : conn.user1Permissions;
        const myPermissions = isUser1 ? conn.user1Permissions : conn.user2Permissions;

        // The view was already filtered by the member's own permissions at
        // publish time (see publishStatus/deriveSharedView) — no permission
        // check is needed here, only "was anything shared at all".
        let view: SharedFamilyView | null = null;
        try {
          view = await this.provider.getSharedStatus(conn.id, memberId);
        } catch {
          // Permission denied or network error — treat as offline
        }

        return {
          id: memberId,
          connectionId: conn.id,
          displayName: isUser1 ? conn.user2DisplayName : conn.user1DisplayName,
          phoneNumber: isUser1 ? conn.user2Phone : conn.user1Phone,
          relationship: conn.relationship,
          connectionStatus: conn.status,
          theirPermissions,
          myPermissions,
          ...memberStatusFromView(view, new Date()),
        } satisfies FamilyMember;
      }),
    );

    return members;
  }

  /**
   * Live status for members a screen is watching. Each update arrives as the
   * member-facing fields only, resolved exactly as `getFamilyMembers` resolves
   * them, so a live row and a loaded row can never disagree.
   */
  watchMemberStatuses(
    members: readonly Pick<FamilyMember, 'id' | 'connectionId'>[],
    onUpdate: (memberId: string, status: MemberStatusFields) => void,
  ): () => void {
    const stops = members.map((m) =>
      this.provider.subscribeSharedStatus(m.connectionId, m.id, (view) =>
        onUpdate(m.id, memberStatusFromView(view, new Date())),
      ),
    );
    return () => stops.forEach((stop) => stop());
  }

  // ─── Watch presence ──────────────────────────────────────────────────────────

  /** Tells `watchedId` that `watcherName` has Watch live open, for the next TTL. */
  announceWatching(
    connectionId: string,
    watcherId: string,
    watcherName: string,
    watchedId: string,
    now: Date,
  ): Promise<void> {
    return this.provider.announceWatching(connectionId, {
      watcherId,
      name: watcherName.trim() || 'Someone in your family',
      watching: watchedId,
      until: new Date(now.getTime() + WATCH_PRESENCE_TTL_MS),
    });
  }

  stopWatching(connectionId: string, watcherId: string): Promise<void> {
    return this.provider.stopWatching(connectionId, watcherId);
  }

  askIfOk(connectionId: string): Promise<AskOkOutcome> {
    return this.provider.askIfOk(connectionId);
  }

  /** Everyone watching `userId` across these connections, merged, live. */
  watchWatchers(
    userId: string,
    connectionIds: readonly string[],
    onChange: (watchers: Watcher[]) => void,
  ): () => void {
    const byConnection = new Map<string, Watcher[]>();
    const stops = connectionIds.map((id) =>
      this.provider.subscribeWatchers(id, userId, (list) => {
        byConnection.set(id, list);
        onChange([...byConnection.values()].flat());
      }),
    );
    return () => stops.forEach((stop) => stop());
  }

  async removeMember(connectionId: string, userId: string): Promise<void> {
    const connections = await this.provider.getConnectionsForUser(userId);
    const conn = connections.find((c) => c.id === connectionId);
    if (!conn) throw new Error('Connection not found.');
    if (conn.user1Id !== userId && conn.user2Id !== userId) {
      throw new Error('You are not a member of this connection.');
    }
    await this.provider.updateConnectionStatus(connectionId, 'CANCELLED');
  }

  async updatePermissions(
    connectionId: string,
    userId: string,
    permissions: FamilyPermissions,
  ): Promise<void> {
    const connections = await this.provider.getConnectionsForUser(userId);
    const conn = connections.find((c) => c.id === connectionId);
    if (!conn) throw new Error('Connection not found.');
    const isUser1 = conn.user1Id === userId;
    await this.provider.updatePermissions(connectionId, isUser1, permissions);
  }

  // ─── Live status publishing ───────────────────────────────────────────────────

  async publishStatus(
    userId: string,
    input: PublishStatusInput,
    previouslyTravelling = false,
    journeyJustCompleted = false,
  ): Promise<void> {
    const now = new Date();
    const status = deriveStatus(input, previouslyTravelling, journeyJustCompleted);

    const rawSnapshot: Omit<FamilyStatusSnapshot, 'userId'> = {
      status,
      batteryLevel: input.batteryLevel,
      lastSeen: now,
      activeJourneyId: input.activeJourneyId,
      activeJourneyDestination: input.activeJourneyDestination,
      activeJourneyEta: input.activeJourneyEta,
      location: input.location,
      journeyProgress:
        input.activeJourneyId && input.routePath
          ? measureJourneyProgress(input.routePath, input.location)
          : null,
      routePath: input.activeJourneyId && input.routePath ? simplifyPath(input.routePath) : null,
      lastCheckInAt: input.activeJourneyId ? input.lastCheckInAt : null,
      nextCheckInAt: input.activeJourneyId ? input.nextCheckInAt : null,
      updatedAt: now,
    };

    const connections = await this.provider.getConnectionsForUser(userId);
    const activeConnections = connections.filter((c) => c.status === 'ACTIVE');

    // Fan out a permission-filtered view to every active connection, alongside
    // the caller's own unfiltered record. One connection's write failing
    // (e.g. a stale permission-denied edge case) must not block the others.
    await Promise.allSettled([
      this.provider.publishOwnStatus(userId, rawSnapshot),
      ...activeConnections.map((conn) => {
        const isUser1 = conn.user1Id === userId;
        const myOutboundPermissions = isUser1 ? conn.user1Permissions : conn.user2Permissions;
        const view = deriveSharedView(rawSnapshot, myOutboundPermissions);
        return this.provider.publishSharedStatus(conn.id, userId, view);
      }),
    ]);
  }
}
