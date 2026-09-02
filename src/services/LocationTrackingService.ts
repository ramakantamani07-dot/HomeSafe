import { AppState, type AppStateStatus } from 'react-native';

import type { LocationProvider, LocationTrackingOptions } from '../providers/LocationProvider';
import type { JourneyProvider } from '../providers/JourneyProvider';
import type { NetworkProvider } from '../providers/NetworkProvider';
import type { Coordinates } from '../models/Journey';
import type { LocationUpdate } from '../models/LocationUpdate';
import type { OfflineSyncService } from './OfflineSyncService';
import {
  type TrackingConfig,
  type MovementState,
  TRACKING_CONFIGS,
  getTrackingConfig,
  LOW_BATTERY_THRESHOLD,
  STATIONARY_SPEED_THRESHOLD_MPS,
} from '../models/TrackingConfig';

export type TrackingCoordinateCallback = (coords: Coordinates) => void;

interface BatchItem {
  update: LocationUpdate;
  userId: string;
  journeyId: string;
}

export class LocationTrackingService {
  private activeUserId: string | null = null;
  private activeJourneyId: string | null = null;
  private coordinateCallback: TrackingCoordinateCallback | null = null;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

  // Mode state — drives config selection
  private sosActive = false;
  private batteryLevel = 1.0;
  private movementState: MovementState = 'MOVING';

  // Batch buffer for journey-mode Firestore writes
  private batchBuffer: BatchItem[] = [];
  private batchFlushTimer: ReturnType<typeof setTimeout> | null = null;

  // Subscription count exposed for diagnostics
  private _subscriptionCount = 0;

  constructor(
    private readonly location: LocationProvider,
    private readonly journeys: JourneyProvider,
    private readonly offlineSync: OfflineSyncService | null = null,
    private readonly network: NetworkProvider | null = null,
  ) {}

  async startTracking(
    userId: string,
    journeyId: string | null,
    onCoordinateUpdate: TrackingCoordinateCallback,
  ): Promise<void> {
    // Prevent duplicate subscriptions: if already tracking for the same journey, no-op.
    if (this.activeJourneyId === journeyId && this.location.isTracking()) return;

    await this.stopTracking();

    this.activeUserId = userId;
    this.activeJourneyId = journeyId;
    this.coordinateCallback = onCoordinateUpdate;
    this._subscriptionCount++;

    const config = this.getEffectiveConfig();
    await this.location.startTracking(
      this.buildLocationOptions(config),
      this.handleLocationUpdate,
    );

    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  async stopTracking(): Promise<void> {
    await this.flushBatch(); // flushBatch clears the timer internally

    await this.location.stopTracking();
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;

    this.activeUserId = null;
    this.activeJourneyId = null;
    this.coordinateCallback = null;
  }

  isTracking(): boolean {
    return this.location.isTracking();
  }

  /** Call when SOS becomes active or is resolved. Drives config to SOS tier (immediate writes). */
  setSOSActive(active: boolean): void {
    this.sosActive = active;
    if (!active && !this.activeJourneyId && this.location.isTracking()) {
      void this.stopTracking();
    }
  }

  /** Called by BatteryContext / LocationTrackingContext whenever the battery level changes. */
  updateBatteryLevel(level: number): void {
    const wasLow = this.batteryLevel < LOW_BATTERY_THRESHOLD;
    this.batteryLevel = level;
    const isNowLow = level < LOW_BATTERY_THRESHOLD;

    // Restart the subscription so the new frequency takes effect immediately.
    // Skip if in SOS-only mode (activeJourneyId is null): SOS always wins over battery config.
    if (wasLow !== isNowLow && this.activeUserId && this.activeJourneyId && this.coordinateCallback) {
      const userId = this.activeUserId;
      const journeyId = this.activeJourneyId;
      const cb = this.coordinateCallback;
      void this.stopTracking().then(() =>
        this.startTracking(userId, journeyId, cb),
      );
    }
  }

  get subscriptionCount(): number {
    return this._subscriptionCount;
  }

  private getEffectiveConfig(): TrackingConfig {
    if (this.sosActive) return TRACKING_CONFIGS.SOS;
    const mode = this.activeJourneyId ? 'JOURNEY' : 'NORMAL';
    return getTrackingConfig(mode, this.batteryLevel, this.movementState);
  }

  private buildLocationOptions(config: TrackingConfig): LocationTrackingOptions {
    return {
      accuracy: config.accuracy,
      timeInterval: config.timeInterval,
      distanceInterval: config.distanceInterval,
      enableBackground: config.mode === 'JOURNEY' || config.mode === 'SOS',
    };
  }

  private handleLocationUpdate = async (update: LocationUpdate): Promise<void> => {
    const userId = this.activeUserId;
    if (!userId) return;

    // Always forward the position to the UI, regardless of Firestore availability.
    this.coordinateCallback?.({ latitude: update.latitude, longitude: update.longitude });
    this.updateMovementState(update.speed);

    // No real journey to write to (SOS-only tracking — location updates are for UI only).
    const journeyId = this.activeJourneyId;
    if (!journeyId) return;

    const config = this.getEffectiveConfig();

    if (config.batchSize <= 1) {
      await this.writeUpdate(userId, journeyId, update);
    } else {
      this.batchBuffer.push({ update, userId, journeyId });
      if (this.batchBuffer.length >= config.batchSize) {
        await this.flushBatch();
      } else if (!this.batchFlushTimer) {
        this.batchFlushTimer = setTimeout(
          () => { void this.flushBatch(); },
          config.batchFlushIntervalMs,
        );
      }
    }
  };

  private async flushBatch(): Promise<void> {
    this.clearBatchTimer();
    const items = this.batchBuffer.splice(0);
    for (const { update, userId, journeyId } of items) {
      await this.writeUpdate(userId, journeyId, update);
    }
  }

  private clearBatchTimer(): void {
    if (this.batchFlushTimer !== null) {
      clearTimeout(this.batchFlushTimer);
      this.batchFlushTimer = null;
    }
  }

  private async writeUpdate(
    userId: string,
    journeyId: string,
    update: LocationUpdate,
  ): Promise<void> {
    try {
      await this.journeys.saveLocationUpdate(userId, journeyId, update);
    } catch {
      if (this.offlineSync && this.network) {
        const { isInternetReachable } = await this.network.fetch().catch(() => ({
          isInternetReachable: false,
        }));
        if (!isInternetReachable) {
          await this.offlineSync.enqueueLocationUpdate(userId, journeyId, update).catch(() => {});
        }
      }
    }
  }

  private updateMovementState(speed: number | null): void {
    const newState: MovementState =
      speed !== null && speed < STATIONARY_SPEED_THRESHOLD_MPS ? 'STATIONARY' : 'MOVING';
    this.movementState = newState;
  }

  private handleAppStateChange = (nextState: AppStateStatus): void => {
    if (nextState !== 'active') return;
    // Journey may be null in SOS-only mode — only require a userId.
    if (!this.activeUserId) return;
    if (this.location.isTracking()) return;

    const config = this.getEffectiveConfig();
    this.location
      .startTracking(this.buildLocationOptions(config), this.handleLocationUpdate)
      .catch(() => {});
  };
}
