import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OfflineQueueProvider, QueuedOperation } from '../../providers/OfflineQueueProvider';

const QUEUE_KEY = 'homesafe.offline-queue';

/**
 * Hard cap on total queue size.
 * When reached, oldest low-priority items (P5+) are evicted before the new
 * item is added. High-priority items (P1–P4) are never evicted automatically.
 */
const MAX_QUEUE_SIZE = 500;

export class AsyncStorageOfflineQueueProvider implements OfflineQueueProvider {
  async getAll(): Promise<QueuedOperation[]> {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as QueuedOperation[];
    } catch {
      return [];
    }
  }

  async enqueue(item: QueuedOperation): Promise<void> {
    let all = await this.getAll();

    // Idempotency: skip if exact same id already in queue
    if (all.some((existing) => existing.id === item.id)) return;

    // Compact before adding if we're at the hard cap
    if (all.length >= MAX_QUEUE_SIZE) {
      all = this.evictLowPriority(all);
    }

    all.push(item);
    await this.persist(all);
  }

  async remove(id: string): Promise<void> {
    const all = await this.getAll();
    const next = all.filter((item) => item.id !== id);
    if (next.length !== all.length) {
      await this.persist(next);
    }
  }

  async update(item: QueuedOperation): Promise<void> {
    const all = await this.getAll();
    const idx = all.findIndex((i) => i.id === item.id);
    if (idx < 0) return;
    all[idx] = item;
    await this.persist(all);
  }

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(QUEUE_KEY);
  }

  /**
   * Removes the oldest low-priority items (priority >= 5) to make room.
   * High-priority items (P1–P4) are never evicted.
   */
  private evictLowPriority(items: QueuedOperation[]): QueuedOperation[] {
    const highPriority = items.filter((i) => i.priority <= 4);
    const lowPriority = items
      .filter((i) => i.priority > 4)
      .sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt)); // oldest first

    // Keep enough low-priority items so total stays below the cap after the new item
    const lowKeepCount = Math.max(0, MAX_QUEUE_SIZE - 1 - highPriority.length);
    const keptLow = lowPriority.slice(lowPriority.length - lowKeepCount);

    return [...highPriority, ...keptLow];
  }

  private async persist(items: QueuedOperation[]): Promise<void> {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  }
}
