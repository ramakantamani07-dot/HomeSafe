import { DataRetentionService } from '../services/DataRetentionService';
import { defaultDataRetentionPolicy } from '../models/DataRetentionPolicy';
import type { OfflineQueueProvider, QueuedOperation } from '../providers/OfflineQueueProvider';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeQueueItem(
  overrides: Partial<QueuedOperation> = {},
): QueuedOperation {
  return {
    id: Math.random().toString(36).slice(2),
    type: 'LOCATION_UPDATE',
    priority: 5,
    payload: {} as QueuedOperation['payload'],
    originalTimestamp: new Date().toISOString(),
    enqueuedAt: new Date().toISOString(),
    retryCount: 3,
    lastAttemptAt: new Date().toISOString(),
    status: 'failed',
    ...overrides,
  };
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function makeQueueProvider(
  initialItems: QueuedOperation[] = [],
): OfflineQueueProvider & { items: QueuedOperation[] } {
  const items = [...initialItems];
  return {
    items,
    async getAll() { return [...items]; },
    async enqueue(item: QueuedOperation) { items.push(item); },
    async remove(id: string) {
      const idx = items.findIndex((i) => i.id === id);
      if (idx !== -1) items.splice(idx, 1);
    },
    async update(item: QueuedOperation) {
      const idx = items.findIndex((i) => i.id === item.id);
      if (idx !== -1) items[idx] = item;
    },
    async clear() { items.length = 0; },
    async getByType() { return []; },
    async getByStatus() { return [...items]; },
  } as unknown as OfflineQueueProvider & { items: QueuedOperation[] };
}

// ─── 1. Default policy values match constants ────────────────────────────────

test('defaultDataRetentionPolicy has expected day counts', () => {
  const policy = defaultDataRetentionPolicy();
  expect(policy.failedOfflineQueueItemsDays).toBe(7);
  expect(policy.completedJourneyLocationHistoryDays).toBe(30);
  expect(policy.cancelledJourneyLocationHistoryDays).toBe(7);
  expect(policy.sosRecordsDays).toBe(90);
});

// ─── 2. No items removed when queue is empty ─────────────────────────────────

test('cleanupExpiredLocalData removes nothing from an empty queue', async () => {
  const queue = makeQueueProvider([]);
  const service = new DataRetentionService(queue);
  const result = await service.cleanupExpiredLocalData();
  expect(result.offlineQueueItemsRemoved).toBe(0);
  expect(result.errors).toHaveLength(0);
});

// ─── 3. Pending items are never removed ──────────────────────────────────────

test('pending offline-queue items are not removed even if old', async () => {
  const old = makeQueueItem({ status: 'pending', enqueuedAt: daysAgo(30) });
  const queue = makeQueueProvider([old]);
  const service = new DataRetentionService(queue);
  await service.cleanupExpiredLocalData();
  expect(queue.items).toHaveLength(1);
});

// ─── 4. Recent failed items are kept ─────────────────────────────────────────

test('failed items enqueued within the retention window are kept', async () => {
  const recent = makeQueueItem({ status: 'failed', enqueuedAt: daysAgo(3) });
  const queue = makeQueueProvider([recent]);
  const service = new DataRetentionService(queue);
  const result = await service.cleanupExpiredLocalData();
  expect(result.offlineQueueItemsRemoved).toBe(0);
  expect(queue.items).toHaveLength(1);
});

// ─── 5. Expired failed items are removed ─────────────────────────────────────

test('failed items older than the retention window are removed', async () => {
  const old1 = makeQueueItem({ id: 'old1', status: 'failed', enqueuedAt: daysAgo(8) });
  const old2 = makeQueueItem({ id: 'old2', status: 'failed', enqueuedAt: daysAgo(10) });
  const recent = makeQueueItem({ id: 'r1', status: 'failed', enqueuedAt: daysAgo(2) });
  const queue = makeQueueProvider([old1, old2, recent]);
  const service = new DataRetentionService(queue);
  const result = await service.cleanupExpiredLocalData();
  expect(result.offlineQueueItemsRemoved).toBe(2);
  expect(queue.items).toHaveLength(1);
  expect(queue.items[0].id).toBe('r1');
});

// ─── 6. Custom policy overrides default window ────────────────────────────────

test('custom policy with shorter window removes more items', async () => {
  const item = makeQueueItem({ status: 'failed', enqueuedAt: daysAgo(4) });
  const queue = makeQueueProvider([item]);
  const service = new DataRetentionService(queue);

  // Default 7-day window — should keep it
  const result1 = await service.cleanupExpiredLocalData();
  expect(result1.offlineQueueItemsRemoved).toBe(0);

  // Custom 3-day window — should remove it
  const result2 = await service.cleanupExpiredLocalData({
    ...defaultDataRetentionPolicy(),
    failedOfflineQueueItemsDays: 3,
  });
  expect(result2.offlineQueueItemsRemoved).toBe(1);
});

// ─── 7. Mixed statuses: only failed are eligible ──────────────────────────────

test('only failed items are eligible for expiry cleanup', async () => {
  const items = [
    makeQueueItem({ id: 'f', status: 'failed', enqueuedAt: daysAgo(10) }),
    makeQueueItem({ id: 'p', status: 'pending', enqueuedAt: daysAgo(10) }),
  ];
  const queue = makeQueueProvider(items);
  const service = new DataRetentionService(queue);
  const result = await service.cleanupExpiredLocalData();
  expect(result.offlineQueueItemsRemoved).toBe(1);
  expect(queue.items.map((i) => i.id)).toEqual(['p']);
});

// ─── 8. Queue read errors are captured in result.errors ───────────────────────

test('queue read failure is captured in errors and does not throw', async () => {
  const brokenQueue = {
    getAll: async () => { throw new Error('disk full'); },
    enqueue: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
    clear: jest.fn(),
  } as unknown as OfflineQueueProvider;
  const service = new DataRetentionService(brokenQueue);
  const result = await service.cleanupExpiredLocalData();
  expect(result.offlineQueueItemsRemoved).toBe(0);
  expect(result.errors.length).toBeGreaterThan(0);
  expect(result.errors[0]).toContain('queue-read');
});
