import type {
  FamilyConnection,
  FamilyConnectionStatus,
  FamilyInvitation,
  FamilyPermissions,
  FamilyStatusSnapshot,
  AskOkOutcome,
  SharedFamilyView,
  Watcher,
} from '../models/Family';

export interface InviteMemberInput {
  fromUserId: string;
  fromDisplayName: string;
  fromPhone: string;
  toPhone: string;
  relationship: string;
}

export interface CreateConnectionInput {
  invitationId: string;
  fromUserId: string;
  fromDisplayName: string;
  fromPhone: string;
  fromRelationship: string;
  toUserId: string;
  toDisplayName: string;
  toPhone: string;
}

export interface FamilyProvider {
  // ─── Invitations ────────────────────────────────────────────────────────────

  /** Create a pending invitation to a phone number. */
  createInvitation(input: InviteMemberInput): Promise<FamilyInvitation>;

  /** All pending invitations sent to this phone number (recipient lookup). */
  getPendingInvitationsForPhone(phone: string): Promise<FamilyInvitation[]>;

  /** All invitations sent by this user (any status). */
  getSentInvitations(userId: string): Promise<FamilyInvitation[]>;

  /** Update an invitation's status (accept / decline / cancel / expire). */
  updateInvitationStatus(
    invitationId: string,
    status: FamilyInvitation['status'],
  ): Promise<void>;

  // ─── Connections ─────────────────────────────────────────────────────────────

  /** Create an ACTIVE connection from an accepted invitation. */
  createConnection(input: CreateConnectionInput): Promise<FamilyConnection>;

  /** All connections where this user is user1 or user2. */
  getConnectionsForUser(userId: string): Promise<FamilyConnection[]>;

  /** Update connection status (CANCELLED, ACTIVE, etc.). */
  updateConnectionStatus(
    connectionId: string,
    status: FamilyConnectionStatus,
  ): Promise<void>;

  /**
   * Update one side's permissions within a connection.
   * isUser1 indicates which permissions field to update.
   */
  updatePermissions(
    connectionId: string,
    isUser1: boolean,
    permissions: FamilyPermissions,
  ): Promise<void>;

  // ─── Live status ─────────────────────────────────────────────────────────────
  //
  // Two separate channels, deliberately kept apart:
  //  - "Own" status is the caller's raw, unfiltered snapshot. Readable only by
  //    the caller themselves — never by another user, at the rules layer.
  //  - "Shared" status is a per-connection, already-permission-filtered view,
  //    computed once at publish time (see `deriveSharedView`) and fanned out to
  //    every active connection. A viewer's rules check is then just "am I a
  //    member of this connection" — the document they're allowed to read
  //    already contains only what the publisher chose to share with them.

  /** Publish the caller's own raw status snapshot (self-readable only). */
  publishOwnStatus(
    userId: string,
    snapshot: Omit<FamilyStatusSnapshot, 'userId'>,
  ): Promise<void>;

  /** Fetch the caller's own raw status snapshot. Null if never published. */
  getOwnStatus(userId: string): Promise<FamilyStatusSnapshot | null>;

  /** Publish a permission-filtered view of the caller's status to one connection. */
  publishSharedStatus(
    connectionId: string,
    publisherUserId: string,
    view: SharedFamilyView,
  ): Promise<void>;

  /**
   * Fetch the filtered view a connection member has published for a given
   * connection. Returns null when nothing has been published yet.
   */
  getSharedStatus(
    connectionId: string,
    publisherUserId: string,
  ): Promise<SharedFamilyView | null>;

  /**
   * The same view, live. For screens a guardian is actively watching only —
   * a listener per family member, held open in the background, would be a
   * steady drain for a list nobody is looking at.
   */
  subscribeSharedStatus(
    connectionId: string,
    publisherUserId: string,
    onChange: (view: SharedFamilyView | null) => void,
  ): () => void;

  /** Announces (or refreshes) that the caller is watching a member, until `watcher.until`. */
  announceWatching(connectionId: string, watcher: Watcher): Promise<void>;

  /** Withdraws the caller's announcement. */
  stopWatching(connectionId: string, watcherId: string): Promise<void>;

  /**
   * Asks the other member of a connection whether they are OK (S2c). Server
   * side: membership, journey and rate limit are checked there. Never throws.
   */
  askIfOk(connectionId: string): Promise<AskOkOutcome>;

  /** Who in this connection is watching `watchedId`, live. */
  subscribeWatchers(
    connectionId: string,
    watchedId: string,
    onChange: (watchers: Watcher[]) => void,
  ): () => void;
}
