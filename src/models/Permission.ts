export type AppPermissionStatus = 'undetermined' | 'granted' | 'denied';

export interface PermissionsState {
  location: AppPermissionStatus;
  /** Placeholder — will be requested when the journey feature is implemented. */
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
