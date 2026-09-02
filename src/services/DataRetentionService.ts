import type { OfflineQueueProvider } from '../providers/OfflineQueueProvider';
import {
  type DataRetentionPolicy,
  defaultDataRetentionPolicy,
} from '../models/DataRetentionPolicy';

export interface CleanupResult {
  offlineQueueItemsRemoved: number;
  errors: string[];
}

export class DataRetentionService {
  constructor(private readonly queueProvider: OfflineQueueProvider) {}

  /**
   * Removes expired local data according to the given policy.
   * Currently cleans failed offline-queue items older than the configured
   * retention window. Server-side data (journey location histories, SOS events)
   * is cleaned by scheduled Cloud Functions — see DATA_RETENTION.md.
   */
  async cleanupExpiredLocalData(
    policy: DataRetentionPolicy = defaultDataRetentionPolicy(),
  ): Promise<CleanupResult> {
    const errors: string[] = [];
    let offlineQueueItemsRemoved = 0;

    try {
      const cutoffMs =
        Date.now() - policy.failedOfflineQueueItemsDays * 24 * 60 * 60 * 1000;
      const all = await this.queueProvider.getAll();
      const expired = all.filter(
        (item) =>
          item.status === 'failed' && new Date(item.enqueuedAt).getTime() < cutoffMs,
      );

      for (const item of expired) {
        try {
          await this.queueProvider.remove(item.id);
          offlineQueueItemsRemoved++;
        } catch {
          errors.push(`queue:${item.id}`);
        }
      }
    } catch (err) {
      errors.push(
        `queue-read: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }

    return { offlineQueueItemsRemoved, errors };
  }
}
