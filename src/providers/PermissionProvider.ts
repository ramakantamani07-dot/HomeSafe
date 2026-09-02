import type { AppPermissionStatus } from '../models/Permission';

export interface PermissionProvider {
  getLocationStatus(): Promise<AppPermissionStatus>;
  requestLocation(): Promise<AppPermissionStatus>;
  getNotificationStatus(): Promise<AppPermissionStatus>;
  requestNotification(): Promise<AppPermissionStatus>;
}
