import type { FamilyProvider, InviteMemberInput, CreateConnectionInput } from '../../providers/FamilyProvider';
import type {
  FamilyConnection,
  FamilyConnectionStatus,
  FamilyInvitation,
  FamilyPermissions,
  FamilyStatusSnapshot,
  AskOkOutcome,
  InviteeStatus,
  SharedFamilyView,
  Watcher,
} from '../../models/Family';
import {
  computeConnectionId,
  defaultFamilyPermissions,
  INVITATION_EXPIRY_DAYS,
  measureJourneyProgress,
} from '../../models/Family';
import type { Coordinates } from '../../models/Journey';

/** Emma's demo walk home: a few streets, about 2 km. */
const DEMO_ROUTE: Coordinates[] = [
  { latitude: 51.5101, longitude: -0.1340 },
  { latitude: 51.5101, longitude: -0.1300 },
  { latitude: 51.5080, longitude: -0.1300 },
  { latitude: 51.5080, longitude: -0.1255 },
  { latitude: 51.5050, longitude: -0.1255 },
  { latitude: 51.5050, longitude: -0.1200 },
  { latitude: 51.5020, longitude: -0.1200 },
];

export class MockFamilyProvider implements FamilyProvider {
  private invitations: FamilyInvitation[] = [];
  private connections: FamilyConnection[] = [];
  private ownStatuses: Map<string, FamilyStatusSnapshot> = new Map();
  private sharedStatuses: Map<string, SharedFamilyView> = new Map();
  private watchers: Map<string, Watcher> = new Map();
  private watcherListeners: Set<() => void> = new Set();
  private sharedListeners: Map<string, Set<(view: SharedFamilyView | null) => void>> = new Map();
  private nextId = 1;

  constructor() {
    // Dev-mode-only demo data so the Family list/Home preview has something
    // to render without needing a second device to accept a real invite.
    // Matches MockAuthProvider's fixed dev user id ('dev-user-001').
    //
    // Built synchronously (no async/await) deliberately: an earlier version
    // called the async createConnection/publishSharedStatus methods from
    // here, which — even though their own bodies have no real async work —
    // still defer past the first `await` to a microtask. That left a real,
    // observed race: FamilyService's own initial fetch (kicked off from a
    // useEffect moments after this constructor returns) could run before the
    // seed's microtasks resolved, rendering members with no status ("Offline")
    // that a manual refresh would never fix since nothing re-triggers it.
    this.seedDemoData();
  }

  private seedDemoData(): void {
    const me = 'dev-user-001';
    const demoMembers = [
      { id: 'demo-emma', name: 'Emma', relationship: 'Daughter', status: 'TRAVELLING' as const },
      { id: 'demo-tom', name: 'Tom', relationship: 'Son', status: 'AT_SCHOOL' as const },
    ];
    const sharePerms: FamilyPermissions = {
      sharingMode: 'SHARE_ALWAYS',
      shareLocation: true,
      shareJourneyDetails: true,
      shareBattery: true,
      shareStatus: true,
    };

    for (const demo of demoMembers) {
      const connectionId = computeConnectionId(me, demo.id);
      const isFromUser1 = me < demo.id;
      const now = new Date();

      this.connections.push({
        id: connectionId,
        user1Id: isFromUser1 ? me : demo.id,
        user2Id: isFromUser1 ? demo.id : me,
        user1DisplayName: isFromUser1 ? 'Dev User' : demo.name,
        user2DisplayName: isFromUser1 ? demo.name : 'Dev User',
        user1Phone: isFromUser1 ? '+911111111111' : '+910000000000',
        user2Phone: isFromUser1 ? '+910000000000' : '+911111111111',
        relationship: demo.relationship,
        theyAreMy: demo.relationship,
        status: 'ACTIVE',
        initiatedBy: me,
        user1Permissions: sharePerms,
        user2Permissions: sharePerms,
        createdAt: now,
        updatedAt: now,
      });

      // Emma's TRAVELLING status is only meaningful paired with real journey
      // details — Home's redesigned family row renders "On the way home" +
      // an ETA clock time when these are present, so the demo seed needs to
      // actually populate them rather than leaving TRAVELLING as a bare label.
      const isTravelling = demo.status === 'TRAVELLING';
      // A walk home with Emma part-way along it, so Family's progress bar and
      // Watch live have a real route to measure rather than a made-up fraction.
      const location = isTravelling ? DEMO_ROUTE[3] : null;
      this.sharedStatuses.set(this.sharedKey(connectionId, demo.id), {
        status: demo.status,
        batteryLevel: 0.64,
        lastSeen: new Date(),
        activeJourneyId: isTravelling ? `demo-journey-${demo.id}` : null,
        activeJourneyDestination: isTravelling ? 'Home' : null,
        activeJourneyEta: isTravelling ? new Date(Date.now() + 19 * 60 * 1000) : null,
        location,
        journeyProgress: isTravelling ? measureJourneyProgress(DEMO_ROUTE, location) : null,
        routePath: isTravelling ? DEMO_ROUTE : null,
        lastCheckInAt: isTravelling ? new Date(Date.now() - 2 * 60 * 1000) : null,
        nextCheckInAt: isTravelling ? new Date(Date.now() + 8 * 60 * 1000) : null,
      });
    }
  }

  private sharedKey(connectionId: string, publisherUserId: string): string {
    return `${connectionId}:${publisherUserId}`;
  }

  private id(): string {
    return `mock-${this.nextId++}`;
  }

  // ─── Invitations ────────────────────────────────────────────────────────────

  async createInvitation(input: InviteMemberInput): Promise<FamilyInvitation> {
    const invitation: FamilyInvitation = {
      id: this.id(),
      fromUserId: input.fromUserId,
      fromDisplayName: input.fromDisplayName,
      fromPhone: input.fromPhone,
      toPhone: input.toPhone,
      relationship: input.relationship,
      theyAreMy: input.theyAreMy,
      status: 'PENDING',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    };
    this.invitations.push(invitation);
    return invitation;
  }

  async getPendingInvitationsForPhone(phone: string): Promise<FamilyInvitation[]> {
    return this.invitations.filter(
      (i) => i.toPhone === phone && i.status === 'PENDING',
    );
  }

  async getSentInvitations(userId: string): Promise<FamilyInvitation[]> {
    return this.invitations.filter((i) => i.fromUserId === userId);
  }

  async updateInvitationStatus(
    invitationId: string,
    status: FamilyInvitation['status'],
  ): Promise<void> {
    const inv = this.invitations.find((i) => i.id === invitationId);
    if (inv) inv.status = status;
  }

  // ─── Connections ─────────────────────────────────────────────────────────────

  async createConnection(input: CreateConnectionInput): Promise<FamilyConnection> {
    const connectionId = computeConnectionId(input.fromUserId, input.toUserId);
    const isFromUser1 = input.fromUserId < input.toUserId;
    const defaultPerms = defaultFamilyPermissions();
    const now = new Date();

    const connection: FamilyConnection = {
      id: connectionId,
      user1Id: isFromUser1 ? input.fromUserId : input.toUserId,
      user2Id: isFromUser1 ? input.toUserId : input.fromUserId,
      user1DisplayName: isFromUser1 ? input.fromDisplayName : input.toDisplayName,
      user2DisplayName: isFromUser1 ? input.toDisplayName : input.fromDisplayName,
      user1Phone: isFromUser1 ? input.fromPhone : input.toPhone,
      user2Phone: isFromUser1 ? input.toPhone : input.fromPhone,
      relationship: input.fromRelationship,
      theyAreMy: input.fromTheyAreMy,
      status: 'ACTIVE',
      initiatedBy: input.fromUserId,
      user1Permissions: defaultPerms,
      user2Permissions: defaultPerms,
      createdAt: now,
      updatedAt: now,
    };

    // Replace any existing connection with same ID
    this.connections = this.connections.filter((c) => c.id !== connectionId);
    this.connections.push(connection);
    return connection;
  }

  async getConnectionsForUser(userId: string): Promise<FamilyConnection[]> {
    return this.connections.filter(
      (c) => c.user1Id === userId || c.user2Id === userId,
    );
  }

  async updateConnectionStatus(
    connectionId: string,
    status: FamilyConnectionStatus,
  ): Promise<void> {
    const conn = this.connections.find((c) => c.id === connectionId);
    if (conn) {
      conn.status = status;
      conn.updatedAt = new Date();
    }
  }

  async updatePermissions(
    connectionId: string,
    isUser1: boolean,
    permissions: FamilyPermissions,
  ): Promise<void> {
    const conn = this.connections.find((c) => c.id === connectionId);
    if (conn) {
      if (isUser1) {
        conn.user1Permissions = permissions;
      } else {
        conn.user2Permissions = permissions;
      }
      conn.updatedAt = new Date();
    }
  }

  // ─── Live status ─────────────────────────────────────────────────────────────

  async publishOwnStatus(
    userId: string,
    snapshot: Omit<FamilyStatusSnapshot, 'userId'>,
  ): Promise<void> {
    this.ownStatuses.set(userId, { ...snapshot, userId });
  }

  async getOwnStatus(userId: string): Promise<FamilyStatusSnapshot | null> {
    return this.ownStatuses.get(userId) ?? null;
  }

  async publishSharedStatus(
    connectionId: string,
    publisherUserId: string,
    view: SharedFamilyView,
  ): Promise<void> {
    const key = this.sharedKey(connectionId, publisherUserId);
    this.sharedStatuses.set(key, view);
    this.sharedListeners.get(key)?.forEach((l) => l(view));
  }

  subscribeSharedStatus(
    connectionId: string,
    publisherUserId: string,
    onChange: (view: SharedFamilyView | null) => void,
  ): () => void {
    const key = this.sharedKey(connectionId, publisherUserId);
    const listeners = this.sharedListeners.get(key) ?? new Set();
    listeners.add(onChange);
    this.sharedListeners.set(key, listeners);
    onChange(this.sharedStatuses.get(key) ?? null);
    return () => listeners.delete(onChange);
  }

  async announceWatching(connectionId: string, watcher: Watcher): Promise<void> {
    this.watchers.set(`${connectionId}:${watcher.watcherId}`, watcher);
    this.watcherListeners.forEach((l) => l());
  }

  /** Demo people have no device, so nothing is delivered — and the screen says so. */
  async askIfOk(_connectionId: string): Promise<AskOkOutcome> {
    return 'no-device';
  }

  /** Indian numbers ending in an even digit "have wayLoc", so both badges are visible in mock mode. */
  async lookupInvitee(phone: string): Promise<InviteeStatus> {
    const last = Number(phone.slice(-1));
    return Number.isNaN(last) ? 'unknown' : last % 2 === 0 ? 'on-wayloc' : 'not-on-wayloc';
  }

  async stopWatching(connectionId: string, watcherId: string): Promise<void> {
    this.watchers.delete(`${connectionId}:${watcherId}`);
    this.watcherListeners.forEach((l) => l());
  }

  subscribeWatchers(
    connectionId: string,
    watchedId: string,
    onChange: (watchers: Watcher[]) => void,
  ): () => void {
    const emit = () =>
      onChange(
        [...this.watchers.entries()]
          .filter(([key, w]) => key.startsWith(`${connectionId}:`) && w.watching === watchedId)
          .map(([, w]) => w),
      );
    this.watcherListeners.add(emit);
    emit();
    return () => this.watcherListeners.delete(emit);
  }

  async getSharedStatus(
    connectionId: string,
    publisherUserId: string,
  ): Promise<SharedFamilyView | null> {
    return this.sharedStatuses.get(this.sharedKey(connectionId, publisherUserId)) ?? null;
  }

  // ─── Test helpers ─────────────────────────────────────────────────────────────

  _reset(): void {
    this.invitations = [];
    this.connections = [];
    this.ownStatuses.clear();
    this.sharedStatuses.clear();
    this.nextId = 1;
  }

  _seedInvitation(inv: FamilyInvitation): void {
    this.invitations.push(inv);
  }

  _seedConnection(conn: FamilyConnection): void {
    this.connections.push(conn);
  }

  /** Seeds a connection member's own raw status (as if they had published it). */
  _seedOwnStatus(snapshot: FamilyStatusSnapshot): void {
    this.ownStatuses.set(snapshot.userId, snapshot);
  }

  /** Seeds the already-filtered view a publisher has shared into one connection. */
  _seedSharedStatus(connectionId: string, publisherUserId: string, view: SharedFamilyView): void {
    const key = this.sharedKey(connectionId, publisherUserId);
    this.sharedStatuses.set(key, view);
    this.sharedListeners.get(key)?.forEach((l) => l(view));
  }
}
