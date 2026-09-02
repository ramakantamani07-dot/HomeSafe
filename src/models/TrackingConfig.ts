export type TrackingMode = 'NORMAL' | 'JOURNEY' | 'SOS' | 'LOW_BATTERY';
export type MovementState = 'MOVING' | 'STATIONARY';

export const LOW_BATTERY_THRESHOLD = 0.15;
export const STATIONARY_SPEED_THRESHOLD_MPS = 0.5;

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

export function getTrackingConfig(
  mode: TrackingMode,
  batteryLevel: number,
  movementState: MovementState,
): TrackingConfig {
  if (mode === 'SOS') return TRACKING_CONFIGS.SOS;

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
