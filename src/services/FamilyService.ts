import type { FamilyProvider } from '../providers/FamilyProvider';
import type {
  FamilyConnection,
  FamilyInvitation,
  FamilyMember,
  FamilyPermissions,
  FamilyStatusSnapshot,
  FamilyStatusType,
  SharedFamilyView,
} from '../models/Family';
import { computeConnectionId, deriveSharedView } from '../models/Family';

const E164_REGEX = /^\+[1-9]\d{6,14}$/;
const OFFLINE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export interface PublishStatusInput {
  activeJourneyId: string | null;
  activeJourneyDestination: string | null;
  activeJourneyEta: Date | null;
  activeSosId: string | null;
  batteryLevel: number | null;
}

function deriveStatus(
  input: PublishStatusInput,
  previouslyTravelling: boolean,
  journeyJustCompleted: boolean,
): FamilyStatusType {
  if (input.activeSosId) return 'SOS_ACTIVE';
  if (input.activeJourneyId) return 'TRAVELLING';
  if (journeyJustCompleted && previouslyTravelling) return 'ARRIVED';
  return 'HOME';
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

        const wasShared = view !== null && view.status !== null;
        const now = new Date();
        const isStale =
          wasShared &&
          view!.lastSeen !== null &&
          now.getTime() - view!.lastSeen.getTime() > OFFLINE_THRESHOLD_MS;

        const derivedStatus: FamilyStatusType = !wasShared || isStale ? 'OFFLINE' : view!.status!;

        return {
          id: memberId,
          connectionId: conn.id,
          displayName: isUser1 ? conn.user2DisplayName : conn.user1DisplayName,
          phoneNumber: isUser1 ? conn.user2Phone : conn.user1Phone,
          relationship: conn.relationship,
          connectionStatus: conn.status,
          theirPermissions,
          myPermissions,
          status: derivedStatus,
          batteryLevel: wasShared ? view!.batteryLevel : null,
          lastSeen: wasShared ? view!.lastSeen : null,
          activeJourneyId: wasShared ? view!.activeJourneyId : null,
          activeJourneyDestination: wasShared ? view!.activeJourneyDestination : null,
          activeJourneyEta: wasShared ? view!.activeJourneyEta : null,
        } satisfies FamilyMember;
      }),
    );

    return members;
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
