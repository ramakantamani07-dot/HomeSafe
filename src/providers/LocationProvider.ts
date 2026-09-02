import type { Coordinates } from '../models/Journey';
import type { LocationUpdate } from '../models/LocationUpdate';

export interface LocationTrackingOptions {
  /** Minimum time in milliseconds between position updates. */
  timeInterval: number;
  /** Minimum distance in metres before a new update is delivered. */
  distanceInterval: number;
  /** GPS accuracy tier. Defaults to 'balanced' if omitted. */
  accuracy?: 'high' | 'balanced' | 'low';
  /** Whether to attempt background-task registration. Defaults to false. */
  enableBackground?: boolean;
}

export type LocationUpdateHandler = (update: LocationUpdate) => void;

export interface LocationProvider {
  /** One-shot current position. Throws if foreground permission is not granted. */
  getCurrentLocation(): Promise<Coordinates>;
  /**
   * Begins continuous position tracking. Fires onUpdate whenever the position
   * changes by at least distanceInterval OR timeInterval elapses — whichever
   * comes first. Throws if foreground permission is not granted.
   */
  startTracking(options: LocationTrackingOptions, onUpdate: LocationUpdateHandler): Promise<void>;
  /** Stops any active tracking subscription. Safe to call when not tracking. */
  stopTracking(): Promise<void>;
  isTracking(): boolean;
}
