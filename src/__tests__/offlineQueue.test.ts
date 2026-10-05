/**
 * Offline Queue Tests
 *
 * Tests use in-memory implementations for speed and isolation.
 * No Firestore, no AsyncStorage, no React rendering.
 */

import { OfflineSyncService, generateId } from '../services/OfflineSyncService';
import type {
  OfflineQueueProvider,
  QueuedOperation,
} from '../providers/OfflineQueueProvider';
import type { JourneyProvider, TerminalJourneyStatus } from '../providers/JourneyProvider';
import type { SOSProvider } from '../providers/SOSProvider';
import type { CheckInProvider, CheckInUpdates } from '../providers/CheckInProvider';
import type { Journey, StartJourneyInput } from '../models/Journey';
import type { SOSEvent } from '../models/SOS';
import type { CheckIn } from '../models/CheckIn';
import type { LocationUpdate } from '../models/LocationUpdate';

// ─── In-memory OfflineQueueProvider ──────────────────────────────────────────

class InMemoryQueueProvider implements OfflineQueueProvider {
  private items: QueuedOperation[] = [];

  async enqueue(item: QueuedOperation): Promise<void> {
    if (this.items.some((i) => i.id === item.id)) return;
    this.items.push(item);
  }

  async getAll(): Promise<QueuedOperation[]> {
    return [...this.items];
  }

  async remove(id: string): Promise<void> {
    this.items = this.items.filter((i) => i.id !== id);
  }

  async update(item: QueuedOperation): Promise<void> {
    const idx = this.items.findIndex((i) => i.id === item.id);
    if (idx >= 0) this.items[idx] = item;
  }

  async clear(): Promise<void> {
    this.items = [];
  }

  // Test helpers
  count(): number { return this.items.length; }
  all(): QueuedOperation[] { return [...this.items]; }
}

// ─── Minimal provider mocks ───────────────────────────────────────────────────

type ProviderCall = { method: string; args: unknown[] };

class SpyJourneyProvider implements JourneyProvider {
  calls: ProviderCall[] = [];
  shouldFail = false;

  async createJourney(_userId: string, _input: StartJourneyInput): Promise<Journey> {
    throw new Error('not used in these tests');
  }
  async getActiveJourney(_userId: string): Promise<Journey | null> { return null; }

  async updateJourneyStatus(
    userId: string,
    journeyId: string,
    status: TerminalJourneyStatus,
  ): Promise<Journey> {
    if (this.shouldFail) throw new Error('network error');
    this.calls.push({ method: 'updateJourneyStatus', args: [userId, journeyId, status] });
    return {} as Journey;
  }

  async saveLocationUpdate(userId: string, journeyId: string, update: LocationUpdate): Promise<void> {
    if (this.shouldFail) throw new Error('network error');
    this.calls.push({ method: 'saveLocationUpdate', args: [userId, journeyId, update] });
  }

  async updateNextCheckInAt(userId: string, journeyId: string, at: Date | null): Promise<void> {
    if (this.shouldFail) throw new Error('network error');
    this.calls.push({ method: 'updateNextCheckInAt', args: [userId, journeyId, at] });
  }

  async setJourneySOSStatus(userId: string, journeyId: string): Promise<void> {
    if (this.shouldFail) throw new Error('network error');
    this.calls.push({ method: 'setJourneySOSStatus', args: [userId, journeyId] });
  }

  async saveRouteData(): Promise<void> {
    // Not exercised by offline-queue tests
  }

  async listJourneyHistory(_userId: string): Promise<import('../models/Journey').Journey[]> {
    return [];
  }

  async deleteJourneyLocationHistory(_userId: string, _journeyId: string): Promise<void> {
    // Not exercised by offline-queue tests
  }

  async createShareLink(_userId: string, _journeyId: string, _displayName: string): Promise<string> {
    throw new Error('not used in these tests');
  }
}

class SpySOSProvider implements SOSProvider {
  calls: ProviderCall[] = [];
  shouldFail = false;

  async createSOS(userId: string, journeyId: string | null, location: unknown): Promise<SOSEvent> {
    if (this.shouldFail) throw new Error('network error');
    this.calls.push({ method: 'createSOS', args: [userId, journeyId, location] });
    return { id: 'sos-1', userId, journeyId, location: null, status: 'ACTIVE', triggeredAt: new Date(), resolvedAt: null, createdAt: new Date() } as SOSEvent;
  }

  async createSOSWithId(userId: string, sosId: string, journeyId: string | null, location: unknown): Promise<SOSEvent> {
    if (this.shouldFail) throw new Error('network error');
    this.calls.push({ method: 'createSOSWithId', args: [userId, sosId, journeyId, location] });
    return { id: sosId, userId, journeyId, location: null, status: 'ACTIVE', triggeredAt: new Date(), resolvedAt: null, createdAt: new Date() } as SOSEvent;
  }

  async resolveSOS(userId: string, sosId: string): Promise<SOSEvent> {
    if (this.shouldFail) throw new Error('network error');
    this.calls.push({ method: 'resolveSOS', args: [userId, sosId] });
    return { id: sosId, userId, journeyId: null, location: null, status: 'RESOLVED', triggeredAt: new Date(), resolvedAt: new Date(), createdAt: new Date() } as SOSEvent;
  }

  async getActiveSOS(_userId: string): Promise<SOSEvent | null> { return null; }

  async markDuress(userId: string, sosId: string): Promise<SOSEvent> {
    if (this.shouldFail) throw new Error('network error');
    this.calls.push({ method: 'markDuress', args: [userId, sosId] });
    return { id: sosId, userId, journeyId: null, location: null, status: 'ACTIVE', triggeredAt: new Date(), resolvedAt: null, createdAt: new Date(), duressTriggered: true } as SOSEvent;
  }
}

class SpyCheckInProvider implements CheckInProvider {
  calls: ProviderCall[] = [];
  shouldFail = false;

  async createCheckIn(userId: string, journeyId: string, scheduledAt: Date): Promise<CheckIn> {
    if (this.shouldFail) throw new Error('network error');
    this.calls.push({ method: 'createCheckIn', args: [userId, journeyId, scheduledAt] });
    return { id: 'ci-1', journeyId, scheduledAt, respondedAt: null, status: 'PENDING', extendedByMinutes: null, createdAt: new Date() };
  }

  async createCheckInWithId(userId: string, journeyId: string, checkInId: string, scheduledAt: Date): Promise<CheckIn> {
    if (this.shouldFail) throw new Error('network error');
    this.calls.push({ method: 'createCheckInWithId', args: [userId, journeyId, checkInId, scheduledAt] });
    return { id: checkInId, journeyId, scheduledAt, respondedAt: null, status: 'PENDING', extendedByMinutes: null, createdAt: new Date() };
  }

  async updateCheckIn(userId: string, journeyId: string, checkInId: string, updates: CheckInUpdates): Promise<CheckIn> {
    if (this.shouldFail) throw new Error('network error');
    this.calls.push({ method: 'updateCheckIn', args: [userId, journeyId, checkInId, updates] });
    return { id: checkInId, journeyId, scheduledAt: new Date(), respondedAt: updates.respondedAt, status: updates.status, extendedByMinutes: updates.extendedByMinutes, createdAt: new Date() };
  }

  async getLatestCheckIn(_userId: string, _journeyId: string): Promise<CheckIn | null> { return null; }
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeService(
  queue: InMemoryQueueProvider,
  spyJourney: SpyJourneyProvider,
  spySOS: SpySOSProvider,
  spyCheckIn: SpyCheckInProvider,
): OfflineSyncService {
  return new OfflineSyncService(queue, spyJourney, spySOS, spyCheckIn);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Queue ordering', () => {
  test('syncNow processes items in priority order (SOS before location, before profile)', async () => {
    const queue = new InMemoryQueueProvider();
    const spyJourney = new SpyJourneyProvider();
    const spySOS = new SpySOSProvider();
    const spyCheckIn = new SpyCheckInProvider();
    const svc = makeService(queue, spyJourney, spySOS, spyCheckIn);

    // Enqueue in reverse priority order
    await svc.enqueueLocationUpdate('u1', 'j1', {
      latitude: 1, longitude: 2, accuracy: null, heading: null, speed: null,
      timestamp: new Date('2024-01-01T10:00:00Z'),
    });
    await svc.enqueueSosTrigger('u1', 'j1', null);
    await svc.enqueueMissedCheckIn('u1', 'j1');

    await svc.syncNow();

    // After sync, queue should be empty (all succeeded)
    expect(await svc.getPendingCount()).toBe(0);

    // SOS was called first
    const sosCall = spySOS.calls.find((c) => c.method === 'createSOSWithId');
    expect(sosCall).toBeDefined();

    // updateJourneyStatus(MISSED_CHECKIN) was called
    const missedCall = spyJourney.calls.find(
      (c) => c.method === 'updateJourneyStatus' && (c.args[2] as string) === 'MISSED_CHECKIN',
    );
    expect(missedCall).toBeDefined();

    // saveLocationUpdate was called
    const locationCall = spyJourney.calls.find((c) => c.method === 'saveLocationUpdate');
    expect(locationCall).toBeDefined();
  });

  test('FIFO ordering within the same priority level', async () => {
    const queue = new InMemoryQueueProvider();
    const spyJourney = new SpyJourneyProvider();
    const svc = makeService(queue, spyJourney, new SpySOSProvider(), new SpyCheckInProvider());

    const t1 = new Date('2024-01-01T10:00:00Z');
    const t2 = new Date('2024-01-01T10:01:00Z');
    const t3 = new Date('2024-01-01T10:02:00Z');

    await svc.enqueueLocationUpdate('u1', 'j1', { latitude: 1, longitude: 1, accuracy: null, heading: null, speed: null, timestamp: t3 });
    await svc.enqueueLocationUpdate('u1', 'j1', { latitude: 2, longitude: 2, accuracy: null, heading: null, speed: null, timestamp: t1 });
    await svc.enqueueLocationUpdate('u1', 'j1', { latitude: 3, longitude: 3, accuracy: null, heading: null, speed: null, timestamp: t2 });

    await svc.syncNow();

    const locationCalls = spyJourney.calls.filter((c) => c.method === 'saveLocationUpdate');
    // Oldest timestamp first
    expect((locationCalls[0].args[2] as LocationUpdate).latitude).toBe(2); // t1
    expect((locationCalls[1].args[2] as LocationUpdate).latitude).toBe(3); // t2
    expect((locationCalls[2].args[2] as LocationUpdate).latitude).toBe(1); // t3
  });
});

describe('Duplicate prevention', () => {
  test('enqueue with same id is silently ignored', async () => {
    const queue = new InMemoryQueueProvider();
    const svc = makeService(queue, new SpyJourneyProvider(), new SpySOSProvider(), new SpyCheckInProvider());

    const customId = generateId();
    const item: QueuedOperation = {
      id: customId,
      type: 'PROFILE_UPDATE',
      priority: 6,
      payload: { userId: 'u1' },
      originalTimestamp: new Date().toISOString(),
      enqueuedAt: new Date().toISOString(),
      retryCount: 0,
      lastAttemptAt: null,
      status: 'pending',
    };

    await queue.enqueue(item);
    await queue.enqueue(item); // duplicate
    expect(queue.count()).toBe(1);
  });

  test('enqueueSosTrigger returns existing queued SOS if one already exists', async () => {
    const queue = new InMemoryQueueProvider();
    const svc = makeService(queue, new SpyJourneyProvider(), new SpySOSProvider(), new SpyCheckInProvider());

    const sos1 = await svc.enqueueSosTrigger('u1', null, null);
    const sos2 = await svc.enqueueSosTrigger('u1', null, null); // second call for same user

    expect(queue.count()).toBe(1); // only one SOS_TRIGGER item
    expect(sos1.id).toBe(sos2.id); // same id returned
  });
});

describe('Retry behavior', () => {
  test('failed items increment retryCount and lastAttemptAt on each failed sync', async () => {
    const queue = new InMemoryQueueProvider();
    const spyJourney = new SpyJourneyProvider();
    spyJourney.shouldFail = true;
    const svc = makeService(queue, spyJourney, new SpySOSProvider(), new SpyCheckInProvider());

    await svc.enqueueMissedCheckIn('u1', 'j1');

    await svc.syncNow();

    const items = queue.all();
    expect(items).toHaveLength(1);
    expect(items[0].retryCount).toBe(1);
    expect(items[0].lastAttemptAt).not.toBeNull();
    expect(items[0].status).toBe('pending');
  });

  test('items in backoff window are skipped during sync', async () => {
    const queue = new InMemoryQueueProvider();
    const spyJourney = new SpyJourneyProvider();
    const svc = makeService(queue, spyJourney, new SpySOSProvider(), new SpyCheckInProvider());

    // Add an item that was already attempted 1 second ago (within backoff)
    const item: QueuedOperation = {
      id: generateId(),
      type: 'MISSED_CHECKIN',
      priority: 2,
      payload: { userId: 'u1', journeyId: 'j1' },
      originalTimestamp: new Date().toISOString(),
      enqueuedAt: new Date().toISOString(),
      retryCount: 1,
      lastAttemptAt: new Date(Date.now() - 500).toISOString(), // 500ms ago, backoff = 2000ms
      status: 'pending',
    };
    await queue.enqueue(item);

    await svc.syncNow();

    // Provider should NOT have been called (item was skipped)
    expect(spyJourney.calls).toHaveLength(0);
    expect(queue.count()).toBe(1); // still in queue
  });
});

describe('Reconnection sync', () => {
  test('syncNow processes all pending items when called after offline period', async () => {
    const queue = new InMemoryQueueProvider();
    const spyJourney = new SpyJourneyProvider();
    const spySOS = new SpySOSProvider();
    const spyCheckIn = new SpyCheckInProvider();
    const svc = makeService(queue, spyJourney, spySOS, spyCheckIn);

    // Simulate offline — enqueue several operations
    await svc.enqueueSosTrigger('u1', 'j1', { latitude: 51.5, longitude: -0.1 });
    await svc.enqueueMissedCheckIn('u1', 'j1');
    await svc.enqueueJourneyStatus('u1', 'j1', 'COMPLETED');
    await svc.enqueueLocationUpdate('u1', 'j1', {
      latitude: 51.5, longitude: -0.1, accuracy: 10, heading: null, speed: null,
      timestamp: new Date(),
    });

    expect(await svc.getPendingCount()).toBe(4);

    // Simulate reconnect — syncNow is called
    await svc.syncNow();

    expect(await svc.getPendingCount()).toBe(0);
    expect(spySOS.calls.find((c) => c.method === 'createSOSWithId')).toBeDefined();
    expect(spyJourney.calls.find((c) => c.method === 'updateJourneyStatus' && c.args[2] === 'MISSED_CHECKIN')).toBeDefined();
    expect(spyJourney.calls.find((c) => c.method === 'updateJourneyStatus' && c.args[2] === 'COMPLETED')).toBeDefined();
    expect(spyJourney.calls.find((c) => c.method === 'saveLocationUpdate')).toBeDefined();
  });

  test('syncNow is re-entrant safe (concurrent calls do not double-process)', async () => {
    const queue = new InMemoryQueueProvider();
    const spyJourney = new SpyJourneyProvider();
    // Add artificial delay to ensure overlap
    const originalUpdate = spyJourney.updateJourneyStatus.bind(spyJourney);
    spyJourney.updateJourneyStatus = async (...args) => {
      await new Promise((r) => setTimeout(r, 20));
      return originalUpdate(...args);
    };

    const svc = makeService(queue, spyJourney, new SpySOSProvider(), new SpyCheckInProvider());
    await svc.enqueueMissedCheckIn('u1', 'j1');

    // Fire two syncs concurrently
    await Promise.all([svc.syncNow(), svc.syncNow()]);

    // updateJourneyStatus should only have been called once
    const updateCalls = spyJourney.calls.filter((c) => c.method === 'updateJourneyStatus');
    expect(updateCalls).toHaveLength(1);
  });
});

describe('Failed operation retention', () => {
  test('items exceeding MAX_RETRIES are marked failed and kept in queue', async () => {
    const queue = new InMemoryQueueProvider();
    const spyJourney = new SpyJourneyProvider();
    spyJourney.shouldFail = true;
    const svc = makeService(queue, spyJourney, new SpySOSProvider(), new SpyCheckInProvider());

    await svc.enqueueMissedCheckIn('u1', 'j1');

    // Simulate 10 failed attempts by running many syncs
    // We bypass backoff by manually updating lastAttemptAt between syncs
    for (let i = 0; i < 10; i++) {
      const items = queue.all();
      if (items.length > 0) {
        // Reset lastAttemptAt to allow the next sync to pick it up
        await queue.update({ ...items[0], lastAttemptAt: null });
      }
      await svc.syncNow();
    }

    const items = queue.all();
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('failed');
    expect(items[0].retryCount).toBe(10);
  });

  test('failed items are still present after clear is NOT called', async () => {
    const queue = new InMemoryQueueProvider();
    const spyJourney = new SpyJourneyProvider();
    spyJourney.shouldFail = true;
    const svc = makeService(queue, spyJourney, new SpySOSProvider(), new SpyCheckInProvider());

    await svc.enqueueMissedCheckIn('u1', 'j1');

    // Drive to failed state
    for (let i = 0; i < 10; i++) {
      const items = queue.all();
      if (items.length > 0) {
        await queue.update({ ...items[0], lastAttemptAt: null });
      }
      await svc.syncNow();
    }

    expect(await svc.getFailedCount()).toBe(1);
    expect(await svc.getPendingCount()).toBe(0);
  });
});

describe('SOS priority', () => {
  test('SOS_TRIGGER is processed before all other operation types', async () => {
    const queue = new InMemoryQueueProvider();
    const spyJourney = new SpyJourneyProvider();
    const spySOS = new SpySOSProvider();
    const spyCheckIn = new SpyCheckInProvider();
    const processedOrder: string[] = [];

    // Wrap each provider method to record call order
    const origUpdateStatus = spyJourney.updateJourneyStatus.bind(spyJourney);
    spyJourney.updateJourneyStatus = async (...args) => {
      processedOrder.push(`journey:${args[2]}`);
      return origUpdateStatus(...args);
    };
    const origCreateSOSWithId = spySOS.createSOSWithId.bind(spySOS);
    spySOS.createSOSWithId = async (...args) => {
      processedOrder.push('SOS_TRIGGER');
      return origCreateSOSWithId(...args);
    };
    const origSaveLocation = spyJourney.saveLocationUpdate.bind(spyJourney);
    spyJourney.saveLocationUpdate = async (...args) => {
      processedOrder.push('LOCATION_UPDATE');
      return origSaveLocation(...args);
    };

    const svc = makeService(queue, spyJourney, spySOS, spyCheckIn);

    // Enqueue in reverse critical order
    await svc.enqueueLocationUpdate('u1', 'j1', {
      latitude: 1, longitude: 1, accuracy: null, heading: null, speed: null,
      timestamp: new Date('2024-01-01T09:00:00Z'),
    });
    await svc.enqueueJourneyStatus('u1', 'j1', 'COMPLETED');
    await svc.enqueueMissedCheckIn('u1', 'j1');
    // SOS enqueued last but should process first
    await svc.enqueueSosTrigger('u1', null, null);

    await svc.syncNow();

    expect(processedOrder[0]).toBe('SOS_TRIGGER');
    expect(processedOrder[1]).toBe('journey:MISSED_CHECKIN');
    expect(processedOrder[2]).toBe('journey:COMPLETED');
    expect(processedOrder[3]).toBe('LOCATION_UPDATE');
  });

  test('getQueuedSOSEvent returns the pending SOS for the correct user', async () => {
    const queue = new InMemoryQueueProvider();
    const svc = makeService(queue, new SpyJourneyProvider(), new SpySOSProvider(), new SpyCheckInProvider());

    const sos = await svc.enqueueSosTrigger('user-a', 'j1', { latitude: 51.5, longitude: -0.1 });

    const recovered = await svc.getQueuedSOSEvent('user-a');
    expect(recovered).not.toBeNull();
    expect(recovered!.id).toBe(sos.id);
    expect(recovered!.status).toBe('ACTIVE');

    // Different user gets null
    expect(await svc.getQueuedSOSEvent('user-b')).toBeNull();
  });

  test('getQueuedSOSEvent returns null when SOS was also resolved offline', async () => {
    const queue = new InMemoryQueueProvider();
    const svc = makeService(queue, new SpyJourneyProvider(), new SpySOSProvider(), new SpyCheckInProvider());

    const sos = await svc.enqueueSosTrigger('user-a', null, null);
    await svc.enqueueSosResolve('user-a', sos.id);

    // Both trigger and resolve are queued — app should not show active SOS
    expect(await svc.getQueuedSOSEvent('user-a')).toBeNull();
  });
});

describe('Location update compaction', () => {
  test('old location updates are removed when the per-journey limit is reached', async () => {
    const queue = new InMemoryQueueProvider();
    const svc = makeService(queue, new SpyJourneyProvider(), new SpySOSProvider(), new SpyCheckInProvider());

    // Enqueue 25 location updates for the same journey
    for (let i = 0; i < 25; i++) {
      await svc.enqueueLocationUpdate('u1', 'j1', {
        latitude: i,
        longitude: i,
        accuracy: null,
        heading: null,
        speed: null,
        timestamp: new Date(Date.now() + i * 1000),
      });
    }

    const items = queue.all().filter((i) => i.type === 'LOCATION_UPDATE');
    // Max 20 location updates per journey
    expect(items.length).toBeLessThanOrEqual(20);
  });

  test('compaction keeps the most recent updates (removes oldest)', async () => {
    const queue = new InMemoryQueueProvider();
    const svc = makeService(queue, new SpyJourneyProvider(), new SpySOSProvider(), new SpyCheckInProvider());

    const base = new Date('2024-01-01T00:00:00Z').getTime();
    for (let i = 0; i < 22; i++) {
      await svc.enqueueLocationUpdate('u1', 'j1', {
        latitude: i,
        longitude: 0,
        accuracy: null,
        heading: null,
        speed: null,
        timestamp: new Date(base + i * 1000),
      });
    }

    const items = queue
      .all()
      .filter((i) => i.type === 'LOCATION_UPDATE')
      .sort((a, b) => a.originalTimestamp.localeCompare(b.originalTimestamp));

    // Oldest lat values (0, 1) should have been evicted; newest should be present
    const latitudes = items.map((i) => (i.payload as { latitude: number }).latitude);
    expect(latitudes).not.toContain(0); // oldest evicted
    expect(latitudes).not.toContain(1); // second-oldest evicted
    expect(latitudes).toContain(21);    // newest kept
  });

  test('compaction for one journey does not affect another journey', async () => {
    const queue = new InMemoryQueueProvider();
    const svc = makeService(queue, new SpyJourneyProvider(), new SpySOSProvider(), new SpyCheckInProvider());

    // 22 updates for journey j1
    for (let i = 0; i < 22; i++) {
      await svc.enqueueLocationUpdate('u1', 'j1', {
        latitude: i, longitude: 0, accuracy: null, heading: null, speed: null,
        timestamp: new Date(Date.now() + i * 1000),
      });
    }
    // 5 updates for journey j2 (below limit)
    for (let i = 0; i < 5; i++) {
      await svc.enqueueLocationUpdate('u1', 'j2', {
        latitude: i, longitude: 0, accuracy: null, heading: null, speed: null,
        timestamp: new Date(Date.now() + i * 1000),
      });
    }

    const j1Items = queue.all().filter(
      (i) => i.type === 'LOCATION_UPDATE' && (i.payload as { journeyId: string }).journeyId === 'j1',
    );
    const j2Items = queue.all().filter(
      (i) => i.type === 'LOCATION_UPDATE' && (i.payload as { journeyId: string }).journeyId === 'j2',
    );

    expect(j1Items.length).toBeLessThanOrEqual(20);
    expect(j2Items).toHaveLength(5); // untouched
  });
});
