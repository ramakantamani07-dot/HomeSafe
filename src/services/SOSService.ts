import type { SOSProvider } from '../providers/SOSProvider';
import type { JourneyProvider } from '../providers/JourneyProvider';
import type { NetworkProvider } from '../providers/NetworkProvider';
import type { SOSEvent } from '../models/SOS';
import type { Coordinates } from '../models/Journey';
import type { OfflineSyncService } from './OfflineSyncService';

export class SOSService {
  constructor(
    private readonly sos: SOSProvider,
    private readonly journeys: JourneyProvider,
    private readonly offlineSync: OfflineSyncService | null = null,
    private readonly network: NetworkProvider | null = null,
  ) {}

  async triggerSOS(
    userId: string,
    journeyId: string | null,
    location: Coordinates | null,
  ): Promise<SOSEvent> {
    // Always check connectivity before attempting Firestore for SOS:
    // the requirement is to save locally immediately when offline.
    const online = this.network ? (await this.network.fetch()).isInternetReachable : true;

    if (!online && this.offlineSync) {
      const event = await this.offlineSync.enqueueSosTrigger(userId, journeyId, location);
      if (journeyId) {
        await this.offlineSync.enqueueJourneySosStatus(userId, journeyId);
      }
      return event;
    }

    try {
      const sosEvent = await this.sos.createSOS(userId, journeyId, location);
      if (journeyId) {
        // Best-effort — do not let a journey write failure block the SOS event
        await this.journeys.setJourneySOSStatus(userId, journeyId).catch(() => {});
      }
      return sosEvent;
    } catch (err) {
      // Network degraded between the connectivity check and the Firestore call
      const stillOnline = this.network
        ? (await this.network.fetch()).isInternetReachable
        : true;
      if (!stillOnline && this.offlineSync) {
        const event = await this.offlineSync.enqueueSosTrigger(userId, journeyId, location);
        if (journeyId) {
          await this.offlineSync.enqueueJourneySosStatus(userId, journeyId);
        }
        return event;
      }
      throw err;
    }
  }

  async resolveSOS(
    userId: string,
    sosId: string,
    journeyId: string | null,
  ): Promise<void> {
    try {
      await this.sos.resolveSOS(userId, sosId);
      if (journeyId) {
        await this.journeys.updateJourneyStatus(userId, journeyId, 'COMPLETED').catch(() => {});
      }
    } catch (err) {
      const online = this.network ? (await this.network.fetch()).isInternetReachable : true;
      if (!online && this.offlineSync) {
        await this.offlineSync.enqueueSosResolve(userId, sosId);
        if (journeyId) {
          await this.offlineSync.enqueueJourneyStatus(userId, journeyId, 'COMPLETED');
        }
        return;
      }
      throw err;
    }
  }

  /**
   * Duress resolve: marks the record so it's clear what happened, but never
   * touches status/resolvedAt or the journey — tracking and the alert both
   * stay exactly as they were. Unlike triggerSOS/resolveSOS this has no
   * offline queue: if the write fails there is nothing safe to retry silently
   * later, so the caller (SOSContext) treats any failure here as a no-op
   * rather than surfacing it — an error dialog would break the cover story.
   */
  async triggerDuress(userId: string, sosId: string): Promise<void> {
    await this.sos.markDuress(userId, sosId);
  }

  async getActiveSOS(userId: string): Promise<SOSEvent | null> {
    const firestoreSOS = await this.sos.getActiveSOS(userId);
    if (firestoreSOS) return firestoreSOS;

    // Fall back to any SOS queued offline — handles app-restart while offline.
    if (this.offlineSync) {
      return this.offlineSync.getQueuedSOSEvent(userId);
    }
    return null;
  }
}
