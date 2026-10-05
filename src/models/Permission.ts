export type AppPermissionStatus = 'undetermined' | 'granted' | 'denied';

export interface PermissionsState {
  location: AppPermissionStatus;
  /**
   * "Always" location status. Read-only status check — the actual request
   * happens just-in-time at journey start (ExpoLocationProvider.startTracking),
   * not from a settings screen, per Apple's just-in-time permission guidance.
   */
  locationBackground: AppPermissionStatus;
  notifications: AppPermissionStatus;
}

export const DEFAULT_PERMISSIONS_STATE: PermissionsState = {
  location: 'undetermined',
  locationBackground: 'undetermined',
  notifications: 'undetermined',
};

export interface PrivacyPreferences {
  biometricLockEnabled: boolean;
}

export const DEFAULT_PRIVACY_PREFERENCES: PrivacyPreferences = {
  biometricLockEnabled: false,
};
