import type { CheckInProvider } from '../providers/CheckInProvider';
import type { JourneyProvider } from '../providers/JourneyProvider';
import type { NetworkProvider } from '../providers/NetworkProvider';
import type { CheckIn } from '../models/CheckIn';
import type { OfflineSyncService } from './OfflineSyncService';

export class CheckInService {
  constructor(
    private readonly checkIns: CheckInProvider,
    private readonly journeys: JourneyProvider,
    private readonly offlineSync: OfflineSyncService | null = null,
    private readonly network: NetworkProvider | null = null,
  ) {}

  async scheduleCheckIn(userId: string, journeyId: string, scheduledAt: Date): Promise<CheckIn> {
    try {
      return await this.checkIns.createCheckIn(userId, journeyId, scheduledAt);
    } catch (err) {
      if (await this.isOffline()) {
        const localId = await this.offlineSync!.enqueueCheckInCreate(
          userId,
          journeyId,
          scheduledAt,
        );
        return {
          id: localId,
          journeyId,
          scheduledAt,
          respondedAt: null,
          status: 'PENDING',
          extendedByMinutes: null,
          createdAt: new Date(),
        };
      }
      throw err;
    }
  }

  getLatestCheckIn(userId: string, journeyId: string): Promise<CheckIn | null> {
    return this.checkIns.getLatestCheckIn(userId, journeyId);
  }

  async confirmSafe(
    userId: string,
    journeyId: string,
    checkInId: string | null,
    intervalMinutes: number,
  ): Promise<Date> {
    const now = new Date();
    const nextAt = new Date(now.getTime() + intervalMinutes * 60_000);
    try {
      if (checkInId) {
        await this.checkIns.updateCheckIn(userId, journeyId, checkInId, {
          status: 'CONFIRMED',
          respondedAt: now,
          extendedByMinutes: null,
        });
      }
      await this.journeys.updateNextCheckInAt(userId, journeyId, nextAt);
    } catch (err) {
      if (await this.isOffline()) {
        if (checkInId) {
          await this.offlineSync!.enqueueCheckInUpdate(
            userId, journeyId, checkInId, 'CONFIRMED', now, null,
          );
        }
        await this.offlineSync!.enqueueNextCheckInAt(userId, journeyId, nextAt);
        return nextAt;
      }
      throw err;
    }
    return nextAt;
  }

  async extendCheckIn(
    userId: string,
    journeyId: string,
    checkInId: string | null,
    byMinutes: number,
  ): Promise<Date> {
    const now = new Date();
    const nextAt = new Date(now.getTime() + byMinutes * 60_000);
    try {
      if (checkInId) {
        await this.checkIns.updateCheckIn(userId, journeyId, checkInId, {
          status: 'EXTENDED',
          respondedAt: now,
          extendedByMinutes: byMinutes,
        });
      }
      await this.journeys.updateNextCheckInAt(userId, journeyId, nextAt);
    } catch (err) {
      if (await this.isOffline()) {
        if (checkInId) {
          await this.offlineSync!.enqueueCheckInUpdate(
            userId, journeyId, checkInId, 'EXTENDED', now, byMinutes,
          );
        }
        await this.offlineSync!.enqueueNextCheckInAt(userId, journeyId, nextAt);
        return nextAt;
      }
      throw err;
    }
    return nextAt;
  }

  async missCheckIn(
    userId: string,
    journeyId: string,
    checkInId: string | null,
  ): Promise<void> {
    try {
      if (checkInId) {
        await this.checkIns.updateCheckIn(userId, journeyId, checkInId, {
          status: 'MISSED',
          respondedAt: null,
          extendedByMinutes: null,
        });
      }
      await this.journeys.updateNextCheckInAt(userId, journeyId, null);
    } catch (err) {
      if (await this.isOffline()) {
        if (checkInId) {
          await this.offlineSync!.enqueueCheckInUpdate(
            userId, journeyId, checkInId, 'MISSED', null, null,
          );
        }
        await this.offlineSync!.enqueueNextCheckInAt(userId, journeyId, null);
        return;
      }
      throw err;
    }
  }

  private async isOffline(): Promise<boolean> {
    if (!this.network || !this.offlineSync) return false;
    return !(await this.network.fetch()).isInternetReachable;
  }
}
