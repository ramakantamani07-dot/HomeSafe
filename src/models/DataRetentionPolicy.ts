/** Days after which each category of data is eligible for automatic cleanup. */
export const DATA_RETENTION_DAYS = {
  /** Detailed GPS trail for completed journeys. */
  completedJourneyLocationHistory: 30,
  /** Detailed GPS trail for cancelled/missed journeys. */
  cancelledJourneyLocationHistory: 7,
  /** SOS event records (kept longer for safety audit purposes). */
  sosRecords: 90,
  /** Failed offline-queue items that could not be synced. */
  failedOfflineQueueItems: 7,
} as const;

export interface DataRetentionPolicy {
  completedJourneyLocationHistoryDays: number;
  cancelledJourneyLocationHistoryDays: number;
  sosRecordsDays: number;
  failedOfflineQueueItemsDays: number;
}

export function defaultDataRetentionPolicy(): DataRetentionPolicy {
  return {
    completedJourneyLocationHistoryDays: DATA_RETENTION_DAYS.completedJourneyLocationHistory,
    cancelledJourneyLocationHistoryDays: DATA_RETENTION_DAYS.cancelledJourneyLocationHistory,
    sosRecordsDays: DATA_RETENTION_DAYS.sosRecords,
    failedOfflineQueueItemsDays: DATA_RETENTION_DAYS.failedOfflineQueueItems,
  };
}
