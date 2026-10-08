export type TrackingMode = 'NORMAL' | 'JOURNEY' | 'UNEASY' | 'SOS' | 'LOW_BATTERY';
export type MovementState = 'MOVING' | 'STATIONARY';

export const LOW_BATTERY_THRESHOLD = 0.15;
export const STATIONARY_SPEED_THRESHOLD_MPS = 0.5;

/**
 * Radius of the arrival geofence around a journey's destination. Wide enough
 * to absorb typical consumer GPS error (10-50m is common, more near tall
 * buildings) without requiring the user to walk to the exact pinned point.
 */
export const ARRIVAL_GEOFENCE_RADIUS_METERS = 150;

export interface TrackingConfig {
  mode: TrackingMode;
  accuracy: 'high' | 'balanced' | 'low';
  timeInterval: number;
  distanceInterval: number;
  batchSize: number;
  batchFlushIntervalMs: number;
}

export const TRACKING_CONFIGS: Record<TrackingMode, TrackingConfig> = {
  NORMAL: {
    mode: 'NORMAL',
    accuracy: 'balanced',
    timeInterval: 60_000,
    distanceInterval: 100,
    batchSize: 1,
    batchFlushIntervalMs: 60_000,
  },
  JOURNEY: {
    mode: 'JOURNEY',
    accuracy: 'balanced',
    timeInterval: 30_000,
    distanceInterval: 50,
    batchSize: 5,
    batchFlushIntervalMs: 60_000,
  },
  /**
   * Raised accuracy after "Feeling uneasy?" (Option 15 `AI5`).
   *
   * Between JOURNEY and SOS on purpose. Someone uneasy is not in an emergency,
   * so draining their battery at SOS rates would be the wrong trade — but the
   * whole reason they tapped is that the next few minutes matter more than the
   * last hour, and guardians watching should see them move in close to real time.
   */
  UNEASY: {
    mode: 'UNEASY',
    accuracy: 'high',
    timeInterval: 15_000,
    distanceInterval: 25,
    batchSize: 1,
    batchFlushIntervalMs: 20_000,
  },
  SOS: {
    mode: 'SOS',
    accuracy: 'high',
    timeInterval: 10_000,
    distanceInterval: 20,
    batchSize: 1,
    batchFlushIntervalMs: 10_000,
  },
  LOW_BATTERY: {
    mode: 'LOW_BATTERY',
    accuracy: 'low',
    timeInterval: 60_000,
    distanceInterval: 100,
    batchSize: 3,
    batchFlushIntervalMs: 90_000,
  },
};

/**
 * How long "Tell my circle" raises the update rate for (Option 15 §D2).
 *
 * The spec's 15 minutes. Long enough to cover the walk home that prompted it,
 * short enough that forgetting to stand it down is not a battery problem.
 */
export const UNEASY_BOOST_MS = 15 * 60 * 1_000;

/**
 * Whether a boost started at `startedAt` is still in force at `now`.
 *
 * Expressed as a deadline comparison rather than a countdown, and that is the
 * whole design: a timer can be frozen by backgrounding, killed with the screen
 * that owns it, or simply lost — and a location boost that silently never ends
 * is a battery leak the user cannot see. Comparing timestamps means the boost
 * expires correctly even if nothing ever fires, so the restore is guaranteed by
 * arithmetic instead of by a callback being trusted to run.
 */
export function isUneasyBoostActive(startedAt: number | null, now: number): boolean {
  if (startedAt === null) return false;
  return now - startedAt < UNEASY_BOOST_MS;
}

export function getTrackingConfig(
  mode: TrackingMode,
  batteryLevel: number,
  movementState: MovementState,
): TrackingConfig {
  if (mode === 'SOS') return TRACKING_CONFIGS.SOS;

  // A boost the user explicitly asked for outranks the battery saver: they
  // know their battery is low and asked anyway. It stays subject to the
  // stationary relaxation below, which costs nothing when they are not moving.
  if (mode === 'UNEASY') {
    const base = TRACKING_CONFIGS.UNEASY;
    return movementState === 'STATIONARY'
      ? { ...base, timeInterval: base.timeInterval * 2, distanceInterval: base.distanceInterval * 2 }
      : base;
  }

  if (batteryLevel < LOW_BATTERY_THRESHOLD) {
    const base = TRACKING_CONFIGS.LOW_BATTERY;
    if (movementState === 'STATIONARY') {
      return { ...base, timeInterval: base.timeInterval * 2, distanceInterval: base.distanceInterval * 2 };
    }
    return base;
  }

  const base = TRACKING_CONFIGS[mode];
  if (movementState === 'STATIONARY' && mode !== 'NORMAL') {
    return { ...base, timeInterval: base.timeInterval * 2, distanceInterval: base.distanceInterval * 2 };
  }

  return base;
}
