import type { PermissionProvider } from '../providers/PermissionProvider';
import type { BiometricProvider } from '../providers/BiometricProvider';
import type { AppPermissionStatus, PermissionsState } from '../models/Permission';

export class PrivacyService {
  constructor(
    private readonly permissions: PermissionProvider,
    private readonly biometric: BiometricProvider,
  ) {}

  async getPermissionsState(): Promise<PermissionsState> {
    const [location, notifications] = await Promise.all([
      this.permissions.getLocationStatus(),
      this.permissions.getNotificationStatus(),
    ]);
    return {
      location,
      locationBackground: 'undetermined', // placeholder — requested with journey feature
      notifications,
    };
  }

  async requestLocation(): Promise<AppPermissionStatus> {
    return this.permissions.requestLocation();
  }

  async requestNotifications(): Promise<AppPermissionStatus> {
    return this.permissions.requestNotification();
  }

  async isBiometricAvailable(): Promise<boolean> {
    return this.biometric.isAvailable();
  }

  async authenticate(reason: string): Promise<boolean> {
    return this.biometric.authenticate(reason);
  }
}
