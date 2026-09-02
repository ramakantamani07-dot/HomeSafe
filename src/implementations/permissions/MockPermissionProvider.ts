import type { PermissionProvider } from '../../providers/PermissionProvider';
import type { AppPermissionStatus } from '../../models/Permission';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class MockPermissionProvider implements PermissionProvider {
  private locationStatus: AppPermissionStatus = 'undetermined';
  private notificationStatus: AppPermissionStatus = 'undetermined';

  async getLocationStatus(): Promise<AppPermissionStatus> {
    return this.locationStatus;
  }

  async requestLocation(): Promise<AppPermissionStatus> {
    await delay(600);
    this.locationStatus = 'granted';
    return this.locationStatus;
  }

  async getNotificationStatus(): Promise<AppPermissionStatus> {
    return this.notificationStatus;
  }

  async requestNotification(): Promise<AppPermissionStatus> {
    await delay(600);
    this.notificationStatus = 'granted';
    return this.notificationStatus;
  }
}
