import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

import type { PermissionProvider } from '../../providers/PermissionProvider';
import type { AppPermissionStatus } from '../../models/Permission';

function mapLocationStatus(status: Location.PermissionStatus): AppPermissionStatus {
  if (status === Location.PermissionStatus.GRANTED) return 'granted';
  if (status === Location.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}

function mapNotificationStatus(status: string): AppPermissionStatus {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export class ExpoPermissionProvider implements PermissionProvider {
  async getLocationStatus(): Promise<AppPermissionStatus> {
    const { status } = await Location.getForegroundPermissionsAsync();
    return mapLocationStatus(status);
  }

  async requestLocation(): Promise<AppPermissionStatus> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return mapLocationStatus(status);
  }

  async getNotificationStatus(): Promise<AppPermissionStatus> {
    const { status } = await Notifications.getPermissionsAsync();
    return mapNotificationStatus(status);
  }

  async requestNotification(): Promise<AppPermissionStatus> {
    const { status } = await Notifications.requestPermissionsAsync();
    return mapNotificationStatus(status);
  }
}
