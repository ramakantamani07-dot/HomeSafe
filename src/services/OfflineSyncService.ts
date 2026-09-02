import type {
  OfflineQueueProvider,
  QueuedOperation,
  OperationType,
  SosTriggerPayload,
  SosResolvePayload,
  MissedCheckInPayload,
  JourneyStatusPayload,
  JourneySosStatusPayload,
  CheckInCreatePayload,
  CheckInUpdatePayload,
  NextCheckInAtPayload,
  LocationUpdatePayload,
} from '../providers/OfflineQueueProvider';
import type { JourneyProvider, TerminalJourneyStatus } from '../providers/JourneyProvider';
import type { SOSProvider } from '../providers/SOSProvider';
import type { CheckInProvider } from '../providers/CheckInProvider';
import type { SOSEvent } from '../models/SOS';
import type { Coordinates } from '../models/Journey';
import type { LocationUpdate } from '../models/LocationUpdate';
import type { CheckInStatus } from '../models/CheckIn';

// ─── Constants ────────────────────────────────────────────────────────────────

const OPERATION_PRIORITY: Record<OperationType, number> = {
  SOS_TRIGGER: 1,
  SOS_RESOLVE: 1,
  MISSED_CHECKIN: 2,
  JOURNEY_STATUS: 3,
  JOURNEY_SOS_STATUS: 3,
  CHECKIN_CREATE: 4,
  CHECKIN_UPDATE: 4,
  NEXT_CHECKIN_AT: 4,
  LOCATION_UPDATE: 5,
  PROFILE_UPDATE: 6,
};

/** Maximum pending location updates stored per journey before compaction. */
const MAX_LOCATION_UPDATES_PER_JOURNEY = 20;

/** Items that reach this retry count are marked 'failed' and kept for inspection. */
const MAX_RETRIES = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** RFC 4122 v4 UUID using Math.random (no native crypto dependency). */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Exponential backoff capped at 5 minutes: 1s, 2s, 4s, …, 300s. */
function backoffMs(retryCount: number): number {
  return Math.min(300_000, 1_000 * Math.pow(2, retryCount));
}

function isInBackoffWindow(item: QueuedOperation): boolean {
  if (!item.lastAttemptAt) return false;
  const elapsed = Date.now() - new Date(item.lastAttemptAt).getTime();
  return elapsed < backoffMs(item.retryCount);
}

function makeOp(
  type: OperationType,
  payload: QueuedOperation['payload'],
  originalTimestamp: string,
): QueuedOperation {
  return {
    id: generateId(),
    type,
    priority: OPERATION_PRIORITY[type],
    payload,
    originalTimestamp,
    enqueuedAt: new Date().toISOString(),
    retryCount: 0,
    lastAttemptAt: null,
    status: 'pending',
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class OfflineSyncService {
  private isSyncing = false;

  constructor(
    private readonly queue: OfflineQueueProvider,
    private readonly journeys: JourneyProvider,
    private readonly sos: SOSProvider,
    private readonly checkIns: CheckInProvider,
  ) {}

  // ─── SOS ──────────────────────────────────────────────────────────────────

  /**
   * Queues an SOS trigger for offline sync. Generates a client-side UUID that
   * becomes the Firestore document ID on sync, so `resolveSOS` works with the
   * same ID regardless of when connectivity returns.
   *
   * Deduplicates: if an unsynced SOS_TRIGGER already exists for this user, the
   * existing queued event is returned rather than creating a duplicate.
   */
  async enqueueSosTrigger(
    userId: string,
    journeyId: string | null,
    location: Coordinates | null,
  ): Promise<SOSEvent> {
    const all = await this.queue.getAll();
    const existing = all.find(
      (i) =>
        i.type === 'SOS_TRIGGER' &&
        i.status === 'pending' &&
        (i.payload as SosTriggerPayload).userId === userId,
    );
    if (existing) {
      return this.sosTriggerItemToEvent(existing);
    }

    const localSosId = generateId();
    const now = new Date().toISOString();
    const payload: SosTriggerPayload = { userId, journeyId, location, localSosId };
    await this.queue.enqueue(makeOp('SOS_TRIGGER', payload, now));

    return {
      id: localSosId,
      userId,
      journeyId,
      location,
      status: 'ACTIVE',
      triggeredAt: new Date(now),
      resolvedAt: null,
      createdAt: new Date(now),
    };
  }

  async enqueueSosResolve(userId: string, sosId: string): Promise<void> {
    const payload: SosResolvePayload = { userId, sosId };
    await this.queue.enqueue(makeOp('SOS_RESOLVE', payload, new Date().toISOString()));
  }

  /**
   * Returns the active SOS event from the queue if the user triggered SOS while
   * offline and it hasn't synced yet. Returns null if no pending SOS, or if the
   * SOS was also resolved offline (both trigger + resolve are queued).
   *
   * Used by SOSService.getActiveSOS as a fallback when Firestore returns null
   * (so emergency mode survives app restarts while offline).
   */
  async getQueuedSOSEvent(userId: string): Promise<SOSEvent | null> {
    const all = await this.queue.getAll();
    const triggerItem = all.find(
      (i) =>
        i.type === 'SOS_TRIGGER' &&
        i.status === 'pending' &&
        (i.payload as SosTriggerPayload).userId === userId,
    );
    if (!triggerItem) return null;

    const p = triggerItem.payload as SosTriggerPayload;

    // If a resolve is also queued for the same SOS, the emergency has ended locally.
    const isAlsoResolved = all.some(
      (i) =>
        i.type === 'SOS_RESOLVE' &&
        i.status === 'pending' &&
        (i.payload as SosResolvePayload).sosId === p.localSosId,
    );
    if (isAlsoResolved) return null;

    return this.sosTriggerItemToEvent(triggerItem);
  }

  // ─── Journey ──────────────────────────────────────────────────────────────

  async enqueueJourneyStatus(
    userId: string,
    journeyId: string,
    status: TerminalJourneyStatus,
  ): Promise<void> {
    const payload: JourneyStatusPayload = { userId, journeyId, status };
    await this.queue.enqueue(makeOp('JOURNEY_STATUS', payload, new Date().toISOString()));
  }

  async enqueueMissedCheckIn(userId: string, journeyId: string): Promise<void> {
    const payload: MissedCheckInPayload = { userId, journeyId };
    await this.queue.enqueue(makeOp('MISSED_CHECKIN', payload, new Date().toISOString()));
  }

  async enqueueJourneySosStatus(userId: string, journeyId: string): Promise<void> {
    const payload: JourneySosStatusPayload = { userId, journeyId };
    await this.queue.enqueue(makeOp('JOURNEY_SOS_STATUS', payload, new Date().toISOString()));
  }

  // ─── Check-in ─────────────────────────────────────────────────────────────

  /**
   * Queues a check-in creation and returns the locally-generated check-in ID.
   * This ID is used as the Firestore document ID on sync replay so that
   * subsequent CHECKIN_UPDATE operations targeting the same ID succeed.
   */
  async enqueueCheckInCreate(
    userId: string,
    journeyId: string,
    scheduledAt: Date,
  ): Promise<string> {
    const localCheckInId = generateId();
    const payload: CheckInCreatePayload = {
      userId,
      journeyId,
      scheduledAt: scheduledAt.toISOString(),
      localCheckInId,
    };
    await this.queue.enqueue(
      makeOp('CHECKIN_CREATE', payload, scheduledAt.toISOString()),
    );
    return localCheckInId;
  }

  async enqueueCheckInUpdate(
    userId: string,
    journeyId: string,
    checkInId: string,
    status: CheckInStatus,
    respondedAt: Date | null,
    extendedByMinutes: number | null,
  ): Promise<void> {
    const payload: CheckInUpdatePayload = {
      userId,
      journeyId,
      checkInId,
      status,
      respondedAt: respondedAt?.toISOString() ?? null,
      extendedByMinutes,
    };
    await this.queue.enqueue(makeOp('CHECKIN_UPDATE', payload, new Date().toISOString()));
  }

  async enqueueNextCheckInAt(
    userId: string,
    journeyId: string,
    nextCheckInAt: Date | null,
  ): Promise<void> {
    const payload: NextCheckInAtPayload = {
      userId,
      journeyId,
      nextCheckInAt: nextCheckInAt?.toISOString() ?? null,
    };
    await this.queue.enqueue(makeOp('NEXT_CHECKIN_AT', payload, new Date().toISOString()));
  }

  // ─── Location ─────────────────────────────────────────────────────────────

  /**
   * Queues a location update, compacting old updates for this journey first.
   * At most MAX_LOCATION_UPDATES_PER_JOURNEY items are kept per journey —
   * the oldest are silently removed to prevent unbounded queue growth.
   */
  async enqueueLocationUpdate(
    userId: string,
    journeyId: string,
    update: LocationUpdate,
  ): Promise<void> {
    await this.compactLocationUpdates(userId, journeyId);

    const payload: LocationUpdatePayload = {
      userId,
      journeyId,
      latitude: update.latitude,
      longitude: update.longitude,
      accuracy: update.accuracy,
      heading: update.heading,
      speed: update.speed,
      timestamp: update.timestamp.toISOString(),
    };
    await this.queue.enqueue(
      makeOp('LOCATION_UPDATE', payload, update.timestamp.toISOString()),
    );
  }

  // ─── Queue state ──────────────────────────────────────────────────────────

  async getPendingCount(): Promise<number> {
    const all = await this.queue.getAll();
    return all.filter((i) => i.status === 'pending').length;
  }

  async getFailedCount(): Promise<number> {
    const all = await this.queue.getAll();
    return all.filter((i) => i.status === 'failed').length;
  }

  async clearQueue(): Promise<void> {
    await this.queue.clear();
  }

  // ─── Sync ─────────────────────────────────────────────────────────────────

  /**
   * Processes all pending items in priority order. Re-entrant-safe: if a sync
   * is already running, the second call returns immediately.
   *
   * Call this when connectivity returns (OfflineSyncContext does this
   * automatically by watching NetworkContext). Also call on app startup to
   * flush items left over from a previous offline session.
   */
  async syncNow(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      await this.processQueue();
    } finally {
      this.isSyncing = false;
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async processQueue(): Promise<void> {
    const all = await this.queue.getAll();
    const pending = all.filter((i) => i.status === 'pending');
    if (pending.length === 0) return;

    // Sort: priority ASC (1 = most critical), then originalTimestamp ASC (FIFO within priority)
    pending.sort((a, b) =>
      a.priority !== b.priority
        ? a.priority - b.priority
        : a.originalTimestamp.localeCompare(b.originalTimestamp),
    );

    for (const item of pending) {
      if (isInBackoffWindow(item)) continue;

      try {
        await this.processItem(item);
        await this.queue.remove(item.id);
      } catch {
        const nextCount = item.retryCount + 1;
        await this.queue.update({
          ...item,
          retryCount: nextCount,
          lastAttemptAt: new Date().toISOString(),
          status: nextCount >= MAX_RETRIES ? 'failed' : 'pending',
        });
      }
    }
  }

  private async processItem(item: QueuedOperation): Promise<void> {
    switch (item.type) {
      case 'SOS_TRIGGER': {
        const p = item.payload as SosTriggerPayload;
        await this.sos.createSOSWithId(p.userId, p.localSosId, p.journeyId, p.location);
        if (p.journeyId) {
          // Best-effort — don't let journey annotation block the SOS write
          await this.journeys.setJourneySOSStatus(p.userId, p.journeyId).catch(() => {});
        }
        break;
      }
      case 'SOS_RESOLVE': {
        const p = item.payload as SosResolvePayload;
        await this.sos.resolveSOS(p.userId, p.sosId);
        break;
      }
      case 'MISSED_CHECKIN': {
        const p = item.payload as MissedCheckInPayload;
        await this.journeys.updateJourneyStatus(p.userId, p.journeyId, 'MISSED_CHECKIN');
        break;
      }
      case 'JOURNEY_STATUS': {
        const p = item.payload as JourneyStatusPayload;
        await this.journeys.updateJourneyStatus(p.userId, p.journeyId, p.status);
        break;
      }
      case 'JOURNEY_SOS_STATUS': {
        const p = item.payload as JourneySosStatusPayload;
        await this.journeys.setJourneySOSStatus(p.userId, p.journeyId);
        break;
      }
      case 'CHECKIN_CREATE': {
        const p = item.payload as CheckInCreatePayload;
        await this.checkIns.createCheckInWithId(
          p.userId,
          p.journeyId,
          p.localCheckInId,
          new Date(p.scheduledAt),
        );
        break;
      }
      case 'CHECKIN_UPDATE': {
        const p = item.payload as CheckInUpdatePayload;
        await this.checkIns.updateCheckIn(p.userId, p.journeyId, p.checkInId, {
          status: p.status,
          respondedAt: p.respondedAt ? new Date(p.respondedAt) : null,
          extendedByMinutes: p.extendedByMinutes,
        });
        break;
      }
      case 'NEXT_CHECKIN_AT': {
        const p = item.payload as NextCheckInAtPayload;
        await this.journeys.updateNextCheckInAt(
          p.userId,
          p.journeyId,
          p.nextCheckInAt ? new Date(p.nextCheckInAt) : null,
        );
        break;
      }
      case 'LOCATION_UPDATE': {
        const p = item.payload as LocationUpdatePayload;
        await this.journeys.saveLocationUpdate(p.userId, p.journeyId, {
          latitude: p.latitude,
          longitude: p.longitude,
          accuracy: p.accuracy,
          heading: p.heading,
          speed: p.speed,
          timestamp: new Date(p.timestamp),
        });
        break;
      }
      case 'PROFILE_UPDATE': {
        // Profile updates are persisted locally via SecureStore (AuthService).
        // No Firestore write needed in the current architecture; this is a no-op.
        break;
      }
    }
  }

  private async compactLocationUpdates(
    userId: string,
    journeyId: string,
  ): Promise<void> {
    const all = await this.queue.getAll();
    const locationItems = all.filter(
      (i) =>
        i.type === 'LOCATION_UPDATE' &&
        (i.payload as LocationUpdatePayload).userId === userId &&
        (i.payload as LocationUpdatePayload).journeyId === journeyId,
    );

    if (locationItems.length < MAX_LOCATION_UPDATES_PER_JOURNEY) return;

    // Remove oldest items so only MAX_LOCATION_UPDATES_PER_JOURNEY - 1 remain,
    // leaving room for the new one about to be enqueued.
    const sorted = [...locationItems].sort((a, b) =>
      a.originalTimestamp.localeCompare(b.originalTimestamp),
    );
    const removeCount = sorted.length - (MAX_LOCATION_UPDATES_PER_JOURNEY - 1);
    for (const item of sorted.slice(0, removeCount)) {
      await this.queue.remove(item.id);
    }
  }

  private sosTriggerItemToEvent(item: QueuedOperation): SOSEvent {
    const p = item.payload as SosTriggerPayload;
    return {
      id: p.localSosId,
      userId: p.userId,
      journeyId: p.journeyId,
      location: p.location,
      status: 'ACTIVE',
      triggeredAt: new Date(item.originalTimestamp),
      resolvedAt: null,
      createdAt: new Date(item.originalTimestamp),
    };
  }
}
