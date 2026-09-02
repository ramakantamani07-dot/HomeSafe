import React, { createContext, useContext, useEffect, useState } from 'react';

import type { AppPermissionStatus, PermissionsState, PrivacyPreferences } from '../models/Permission';
import { DEFAULT_PERMISSIONS_STATE, DEFAULT_PRIVACY_PREFERENCES } from '../models/Permission';
import type { PrivacyService } from '../services/PrivacyService';
import {
  loadPrivacyPreferences,
  savePrivacyPreferences,
} from '../implementations/storage/SecurePrivacyStore';

interface PrivacyContextValue {
  // OS permission statuses
  locationStatus: AppPermissionStatus;
  notificationStatus: AppPermissionStatus;
  // Device capability
  biometricAvailable: boolean;
  // User preference (SecureStore)
  biometricLockEnabled: boolean;
  // Global loading flag — splash screen waits for this
  isLoading: boolean;
  // Actions
  requestLocationPermission(): Promise<AppPermissionStatus>;
  requestNotificationPermission(): Promise<AppPermissionStatus>;
  enableBiometricLock(): Promise<void>;
  disableBiometricLock(): Promise<void>;
  /** Runs biometric auth for the in-app lock gate. Returns true on success. */
  unlockWithBiometric(): Promise<boolean>;
  refreshPermissions(): Promise<void>;
}

export const PrivacyContext = createContext<PrivacyContextValue>({
  locationStatus: 'undetermined',
  notificationStatus: 'undetermined',
  biometricAvailable: false,
  biometricLockEnabled: false,
  isLoading: true,
  requestLocationPermission: async () => 'undetermined',
  requestNotificationPermission: async () => 'undetermined',
  enableBiometricLock: async () => {},
  disableBiometricLock: async () => {},
  unlockWithBiometric: async () => false,
  refreshPermissions: async () => {},
});

export function PrivacyStateProvider({
  privacyService,
  children,
}: {
  privacyService: PrivacyService;
  children: React.ReactNode;
}) {
  const [permissions, setPermissions] = useState<PermissionsState>(DEFAULT_PERMISSIONS_STATE);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [preferences, setPreferences] = useState<PrivacyPreferences>(DEFAULT_PRIVACY_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      privacyService.getPermissionsState(),
      privacyService.isBiometricAvailable(),
      loadPrivacyPreferences(),
    ])
      .then(([perms, bioAvailable, prefs]) => {
        if (!mounted) return;
        setPermissions(perms);
        setBiometricAvailable(bioAvailable);
        setPreferences(prefs);
      })
      .catch(() => { /* leave defaults */ })
      .finally(() => { if (mounted) setIsLoading(false); });

    return () => { mounted = false; };
  }, [privacyService]);

  const savePrefs = async (next: PrivacyPreferences) => {
    await savePrivacyPreferences(next);
    setPreferences(next);
  };

  const value: PrivacyContextValue = {
    locationStatus: permissions.location,
    notificationStatus: permissions.notifications,
    biometricAvailable,
    biometricLockEnabled: preferences.biometricLockEnabled,
    isLoading,

    requestLocationPermission: async () => {
      const status = await privacyService.requestLocation();
      setPermissions((prev) => ({ ...prev, location: status }));
      return status;
    },

    requestNotificationPermission: async () => {
      const status = await privacyService.requestNotifications();
      setPermissions((prev) => ({ ...prev, notifications: status }));
      return status;
    },

    enableBiometricLock: async () => {
      const success = await privacyService.authenticate(
        'Confirm your identity to enable biometric lock.'
      );
      if (!success) throw new Error('Biometric confirmation failed. Biometric lock was not enabled.');
      await savePrefs({ ...preferences, biometricLockEnabled: true });
    },

    disableBiometricLock: async () => {
      await savePrefs({ ...preferences, biometricLockEnabled: false });
    },

    unlockWithBiometric: () =>
      privacyService.authenticate('Unlock HomeSafe'),

    refreshPermissions: async () => {
      const perms = await privacyService.getPermissionsState();
      setPermissions(perms);
    },
  };

  return (
    <PrivacyContext.Provider value={value}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacyContext(): PrivacyContextValue {
  return useContext(PrivacyContext);
}
