import type { JourneyProvider } from '../providers/JourneyProvider';
import type { LocationProvider } from '../providers/LocationProvider';
import type { NetworkProvider } from '../providers/NetworkProvider';
import type { Journey } from '../models/Journey';
import type { OfflineSyncService } from './OfflineSyncService';

const MAX_DESTINATION_LENGTH = 100;

export class JourneyService {
  constructor(
    private readonly journeys: JourneyProvider,
    private readonly location: LocationProvider,
    private readonly offlineSync: OfflineSyncService | null = null,
    private readonly network: NetworkProvider | null = null,
  ) {}

  async startJourney(
    userId: string,
    rawLabel: string,
    checkInIntervalMinutes: number | null,
    destinationCoordinates: import('../models/Journey').Coordinates | null = null,
  ): Promise<Journey> {
    const destinationLabel = rawLabel.trim();
    if (!destinationLabel) {
      throw new Error('Please enter a destination name before starting.');
    }
    if (destinationLabel.length > MAX_DESTINATION_LENGTH) {
      throw new Error(`Destination must be ${MAX_DESTINATION_LENGTH} characters or less.`);
    }

    const existing = await this.journeys.getActiveJourney(userId);
    if (existing) {
      throw new Error('You already have an active journey. End it before starting a new one.');
    }

    const startLocation = await this.location.getCurrentLocation();

    return this.journeys.createJourney(userId, {
      destinationLabel,
      startLocation,
      checkInIntervalMinutes,
      destinationCoordinates,
    });
  }

  async endJourney(userId: string, journeyId: string): Promise<Journey> {
    try {
      return await this.journeys.updateJourneyStatus(userId, journeyId, 'COMPLETED');
    } catch (err) {
      if (await this.isOffline()) {
        await this.offlineSync!.enqueueJourneyStatus(userId, journeyId, 'COMPLETED');
        return this.syntheticJourney(userId, journeyId, 'COMPLETED');
      }
      throw err;
    }
  }

  async cancelJourney(userId: string, journeyId: string): Promise<Journey> {
    try {
      return await this.journeys.updateJourneyStatus(userId, journeyId, 'CANCELLED');
    } catch (err) {
      if (await this.isOffline()) {
        await this.offlineSync!.enqueueJourneyStatus(userId, journeyId, 'CANCELLED');
        return this.syntheticJourney(userId, journeyId, 'CANCELLED');
      }
      throw err;
    }
  }

  async missedCheckIn(userId: string, journeyId: string): Promise<Journey> {
    try {
      return await this.journeys.updateJourneyStatus(userId, journeyId, 'MISSED_CHECKIN');
    } catch (err) {
      if (await this.isOffline()) {
        await this.offlineSync!.enqueueMissedCheckIn(userId, journeyId);
        return this.syntheticJourney(userId, journeyId, 'MISSED_CHECKIN');
      }
      throw err;
    }
  }

  async getActiveJourney(userId: string): Promise<Journey | null> {
    return this.journeys.getActiveJourney(userId);
  }

  async saveRouteData(
    userId: string,
    journeyId: string,
    distanceMeters: number,
    durationSeconds: number,
    initialEta: Date,
  ): Promise<void> {
    await this.journeys.saveRouteData(userId, journeyId, distanceMeters, durationSeconds, initialEta);
  }

  /**
   * Deletes the detailed location trail (locationUpdates sub-collection) for
   * all completed, cancelled, missed, or SOS-triggered journeys.
   * The journey summary documents (destination, dates, status) are kept.
   * Returns the count of journeys processed and any that could not be cleaned.
   */
  async deleteJourneyHistory(
    userId: string,
  ): Promise<{ processed: number; errors: string[] }> {
    const journeys = await this.journeys.listJourneyHistory(userId);
    const errors: string[] = [];

    for (const j of journeys) {
      try {
        await this.journeys.deleteJourneyLocationHistory(userId, j.id);
      } catch {
        errors.push(j.id);
      }
    }

    return { processed: journeys.length - errors.length, errors };
  }

  private async isOffline(): Promise<boolean> {
    if (!this.network || !this.offlineSync) return false;
    return !(await this.network.fetch()).isInternetReachable;
  }

  private syntheticJourney(
    userId: string,
    journeyId: string,
    status: Journey['status'],
  ): Journey {
    const now = new Date();
    return {
      id: journeyId,
      userId,
      destinationLabel: '',
      startLocation: { latitude: 0, longitude: 0 },
      destinationCoordinates: null,
      currentLocation: null,
      status,
      startedAt: now,
      endedAt: now,
      createdAt: now,
      checkInIntervalMinutes: null,
      nextCheckInAt: null,
      routeDistanceMeters: null,
      routeDurationSeconds: null,
      initialEta: null,
    };
  }
}
