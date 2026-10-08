import { AppState, type AppStateStatus } from 'react-native';

import type { LocationProvider, LocationTrackingOptions } from '../providers/LocationProvider';
import type { JourneyProvider } from '../providers/JourneyProvider';
import type { NetworkProvider } from '../providers/NetworkProvider';
import type { Coordinates } from '../models/Journey';
import type { TrackingMotion } from '../providers/LocationProvider';
import type { LocationUpdate } from '../models/LocationUpdate';
import type { OfflineSyncService } from './OfflineSyncService';
import {
  type TrackingConfig,
  type MovementState,
  TRACKING_CONFIGS,
  getTrackingConfig,
  LOW_BATTERY_THRESHOLD,
  STATIONARY_SPEED_THRESHOLD_MPS,
  UNEASY_BOOST_MS,
  isUneasyBoostActive,
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
  /** When "Tell my circle" last raised the update rate. Null when never, or stood down. */
  private uneasyBoostStartedAt: number | null = null;
  private uneasyBoostTimer: ReturnType<typeof setTimeout> | null = null;
  private batteryLevel = 1.0;
  private movementState: MovementState = 'MOVING';

  // Batch buffer for journey-mode Firestore writes
  private batchBuffer: BatchItem[] = [];
  private batchFlushTimer: ReturnType<typeof setTimeout> | null = null;
  /** Motion profile of the current journey — passed to the OS for GPS tuning. */
  private motion: TrackingMotion = 'unknown';

  // Subscription count exposed for diagnostics
  private _subscriptionCount = 0;

  // Tracks whether background mode was actually engaged (not just requested)
  // when tracking started, so a later downgrade can be detected on resume.
  private wasUsingBackground = false;

  /**
   * Fires when background ("Always") location permission is found to have
   * been revoked mid-session, after background mode had actually engaged.
   * Settable directly by the context that owns this service — there's no way
   * to get a push-based OS event for this, so it's only ever detected
   * reactively, on app-foreground resume (see handleAppStateChange).
   */
  onBackgroundPermissionRevoked: (() => void) | null = null;

  constructor(
    private readonly location: LocationProvider,
    private readonly journeys: JourneyProvider,
    private readonly offlineSync: OfflineSyncService | null = null,
    private readonly network: NetworkProvider | null = null,
  ) {}

  /**
   * A single position fix, for callers that need an origin before any journey
   * exists. Goes through the LocationProvider port like everything else here,
   * so screens and hooks never touch expo-location directly.
   *
   * Rejects when foreground permission is not granted — the provider does not
   * prompt, so this can be called freely without triggering an OS dialog at a
   * moment the user has not been told why.
   */
  getCurrentLocation(): Promise<Coordinates> {
    return this.location.getCurrentLocation();
  }

  async startTracking(
    userId: string,
    journeyId: string | null,
    onCoordinateUpdate: TrackingCoordinateCallback,
    motion: TrackingMotion = 'unknown',
  ): Promise<void> {
    // Prevent duplicate subscriptions: if already tracking for the same journey, no-op.
    if (this.activeJourneyId === journeyId && this.location.isTracking()) return;

    await this.stopTracking();

    this.activeUserId = userId;
    this.activeJourneyId = journeyId;
    this.coordinateCallback = onCoordinateUpdate;
    this.motion = motion;
    this._subscriptionCount++;

    const config = this.getEffectiveConfig();
    await this.location.startTracking(
      this.buildLocationOptions(config),
      this.handleLocationUpdate,
    );
    this.wasUsingBackground = this.location.isUsingBackgroundMode();

    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

    // Re-arm the boost's expiry timer from its deadline. The deadline is a
    // plain timestamp and survives any number of restarts, so the boost is
    // preserved while the timer itself never outlives a tracking session.
    this.armUneasyBoostTimer();
  }

  async stopTracking(): Promise<void> {
    await this.flushBatch(); // flushBatch clears the timer internally

    await this.location.stopTracking();
    this.clearUneasyBoostTimer();
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    this.wasUsingBackground = false;

    this.activeUserId = null;
    this.activeJourneyId = null;
    this.coordinateCallback = null;
  }

  isTracking(): boolean {
    return this.location.isTracking();
  }

  /** Call when SOS becomes active or is resolved. Drives config to SOS tier (immediate writes). */
  /**
   * Raises the update rate for UNEASY_BOOST_MS (Option 15 §D2).
   *
   * The timer here only re-applies the location options at expiry so the device
   * stops sampling fast; it is **not** what makes the boost end. That is
   * `getEffectiveConfig`'s deadline check, which is why losing this timer
   * degrades to "the next config resolution fixes it" rather than to a boost
   * that never stands down. Calling again restarts the window.
   */
  startUneasyBoost(): void {
    this.uneasyBoostStartedAt = Date.now();
    this.armUneasyBoostTimer();
    this.restartTracking();
  }

  /**
   * Schedules the drop back to normal rates for whatever is left of the window.
   *
   * Idempotent, and safe to call on every tracking start: with no boost running
   * it does nothing, and with one already expired it stands the boost down
   * immediately rather than scheduling a timer in the past.
   */
  private armUneasyBoostTimer(): void {
    this.clearUneasyBoostTimer();
    if (this.uneasyBoostStartedAt === null) return;

    const remaining = this.uneasyBoostStartedAt + UNEASY_BOOST_MS - Date.now();
    if (remaining <= 0) {
      this.uneasyBoostStartedAt = null;
      return;
    }

    this.uneasyBoostTimer = setTimeout(() => {
      this.uneasyBoostTimer = null;
      this.uneasyBoostStartedAt = null;
      this.restartTracking();
    }, remaining);
  }

  /** True while the boost is in force. Deadline-checked, never a stored flag. */
  isUneasyBoostActive(): boolean {
    return isUneasyBoostActive(this.uneasyBoostStartedAt, Date.now());
  }

  private clearUneasyBoostTimer(): void {
    if (this.uneasyBoostTimer) {
      clearTimeout(this.uneasyBoostTimer);
      this.uneasyBoostTimer = null;
    }
  }

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
    if (wasLow !== isNowLow) this.restartTracking();
  }

  /**
   * Re-subscribes so a newly-resolved effective config takes effect now rather
   * than at the next natural restart.
   *
   * A no-op when nothing is being tracked — which is also why callers do not
   * need to check: SOS-only mode has no activeJourneyId, and a boost requested
   * with no subscription running simply applies when one starts.
   */
  private restartTracking(): void {
    if (!this.activeUserId || !this.activeJourneyId || !this.coordinateCallback) return;
    const userId = this.activeUserId;
    const journeyId = this.activeJourneyId;
    const cb = this.coordinateCallback;
    void this.stopTracking().then(() => this.startTracking(userId, journeyId, cb));
  }

  get subscriptionCount(): number {
    return this._subscriptionCount;
  }

  /** Registers an OS-level arrival geofence. See LocationProvider.startGeofencing. */
  async startGeofencing(
    destination: Coordinates,
    radiusMeters: number,
    onArrival: () => void,
  ): Promise<void> {
    await this.location.startGeofencing(destination, radiusMeters, onArrival);
  }

  /** Removes any active arrival geofence. Safe to call when none is registered. */
  async stopGeofencing(): Promise<void> {
    await this.location.stopGeofencing();
  }

  private getEffectiveConfig(): TrackingConfig {
    if (this.sosActive) return TRACKING_CONFIGS.SOS;

    // Checked by deadline on every resolution, so an expired boost stops
    // applying even if the timer below never fired — see isUneasyBoostActive.
    if (isUneasyBoostActive(this.uneasyBoostStartedAt, Date.now())) {
      return getTrackingConfig('UNEASY', this.batteryLevel, this.movementState);
    }

    const mode = this.activeJourneyId ? 'JOURNEY' : 'NORMAL';
    return getTrackingConfig(mode, this.batteryLevel, this.movementState);
  }

  private buildLocationOptions(config: TrackingConfig): LocationTrackingOptions {
    return {
      accuracy: config.accuracy,
      timeInterval: config.timeInterval,
      distanceInterval: config.distanceInterval,
      enableBackground: config.mode === 'JOURNEY' || config.mode === 'SOS',
      motion: this.motion,
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

    // Detect a mid-session downgrade: background mode was engaged when
    // tracking started, but the OS-level "Always" grant has since been
    // silently revoked (e.g. iOS's own background-usage privacy nudge).
    // There's no push-based event for this — foreground resume is the
    // natural, low-cost point to re-check.
    if (this.wasUsingBackground && !this.location.isUsingBackgroundMode()) {
      this.location
        .hasBackgroundPermission()
        .then((granted) => {
          if (!granted) {
            this.wasUsingBackground = false;
            this.onBackgroundPermissionRevoked?.();
          }
        })
        .catch(() => {});
    }

    if (this.location.isTracking()) return;

    const config = this.getEffectiveConfig();
    this.location
      .startTracking(this.buildLocationOptions(config), this.handleLocationUpdate)
      .catch(() => {});
  };
}
