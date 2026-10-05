import type { AppPermissionStatus } from '../models/Permission';

export interface PermissionProvider {
  getLocationStatus(): Promise<AppPermissionStatus>;
  requestLocation(): Promise<AppPermissionStatus>;
  /**
   * Background ("Always") location status. Read-only — deliberately no
   * `requestLocationBackground()` here. Apple's guidance (and iOS's own
   * behavior) is to ask for this upgrade at the moment the feature that
   * needs it is actually used, not from a settings screen in isolation;
   * ExpoLocationProvider.startTracking already requests it at journey start.
   */
  getLocationBackgroundStatus(): Promise<AppPermissionStatus>;
  getNotificationStatus(): Promise<AppPermissionStatus>;
  requestNotification(): Promise<AppPermissionStatus>;
}
