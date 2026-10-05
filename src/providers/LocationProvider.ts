import type { Coordinates } from '../models/Journey';
import type { LocationUpdate } from '../models/LocationUpdate';

/**
 * How the traveller is moving, as a platform-free concept.
 *
 * iOS turns this into a CLActivityType and tunes the GPS duty cycle from it;
 * Android ignores it. Expressed in our own vocabulary so the port does not
 * leak an Apple enum into every caller.
 */
export type TrackingMotion = 'pedestrian' | 'vehicle' | 'unknown';

export interface LocationTrackingOptions {
  /** Minimum time in milliseconds between position updates. */
  timeInterval: number;
  /** Minimum distance in metres before a new update is delivered. */
  distanceInterval: number;
  /** GPS accuracy tier. Defaults to 'balanced' if omitted. */
  accuracy?: 'high' | 'balanced' | 'low';
  /** Whether to attempt background-task registration. Defaults to false. */
  enableBackground?: boolean;
  /**
   * How the traveller is moving.
   *
   * Passed to the OS so it can tune the GPS duty cycle to the expected motion
   * — a pedestrian needs far less radio than a car on a motorway. Expressed as
   * a domain concept rather than an iOS enum so the port stays platform-free;
   * the adapter maps it.
   */
  motion?: TrackingMotion;
}

export type LocationUpdateHandler = (update: LocationUpdate) => void;
export type ArrivalHandler = () => void;

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
  /** True if the current tracking session actually engaged background mode (not just requested it — see startTracking's fallback behavior). */
  isUsingBackgroundMode(): boolean;
  /** Read-only background ("Always") permission check — never prompts. Used to detect a mid-journey downgrade (e.g. iOS silently revoking Always after its own privacy nudge). */
  hasBackgroundPermission(): Promise<boolean>;
  /**
   * Registers an OS-level geofence around `destination` and calls `onArrival`
   * once when the device enters it. Unlike continuous tracking, this is
   * monitored by the OS independent of the JS runtime — it fires even if the
   * app was backgrounded or the JS timer/polling would otherwise have
   * stalled. A no-op (resolves without effect) when the background task
   * infrastructure isn't available, matching startTracking's fallback
   * philosophy — arrival detection is a bonus, not a feature the rest of the
   * app depends on for safety.
   */
  startGeofencing(
    destination: Coordinates,
    radiusMeters: number,
    onArrival: ArrivalHandler,
  ): Promise<void>;
  /** Removes any active geofence. Safe to call when none is registered. */
  stopGeofencing(): Promise<void>;
}
