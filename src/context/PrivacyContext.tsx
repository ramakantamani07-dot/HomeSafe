import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { AppPermissionStatus, PermissionsState, PrivacyPreferences } from '../models/Permission';
import { DEFAULT_PERMISSIONS_STATE, DEFAULT_PRIVACY_PREFERENCES } from '../models/Permission';
import type { PrivacyService } from '../services/PrivacyService';
import {
  loadPrivacyPreferences,
  savePrivacyPreferences,
} from '../implementations/storage/SecurePrivacyStore';
import {
  loadDuressCode,
  saveDuressCode,
  clearDuressCode,
} from '../implementations/storage/SecureDuressStore';

interface PrivacyContextValue {
  // OS permission statuses
  locationStatus: AppPermissionStatus;
  locationBackgroundStatus: AppPermissionStatus;
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
  // Duress ("silent SOS") code — a separate PIN that a fake-resolves an
  // active SOS: see SOSContext.triggerDuress.
  duressCodeSet: boolean;
  setDuressCode(code: string): Promise<void>;
  removeDuressCode(): Promise<void>;
  verifyDuressCode(code: string): Promise<boolean>;
}

export const PrivacyContext = createContext<PrivacyContextValue>({
  locationStatus: 'undetermined',
  locationBackgroundStatus: 'undetermined',
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
  duressCodeSet: false,
  setDuressCode: async () => {},
  removeDuressCode: async () => {},
  verifyDuressCode: async () => false,
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
  const [duressCodeSet, setDuressCodeSet] = useState(false);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      privacyService.getPermissionsState(),
      privacyService.isBiometricAvailable(),
      loadPrivacyPreferences(),
      loadDuressCode(),
    ])
      .then(([perms, bioAvailable, prefs, duressCode]) => {
        if (!mounted) return;
        setPermissions(perms);
        setBiometricAvailable(bioAvailable);
        setPreferences(prefs);
        setDuressCodeSet(duressCode !== null);
      })
      .catch(() => { /* leave defaults */ })
      .finally(() => { if (mounted) setIsLoading(false); });

    return () => { mounted = false; };
  }, [privacyService]);

  const savePrefs = useCallback(async (next: PrivacyPreferences) => {
    await savePrivacyPreferences(next);
    setPreferences(next);
  }, []);

  const requestLocationPermission = useCallback(async () => {
    const status = await privacyService.requestLocation();
    setPermissions((prev) => ({ ...prev, location: status }));
    return status;
  }, [privacyService]);

  const requestNotificationPermission = useCallback(async () => {
    const status = await privacyService.requestNotifications();
    setPermissions((prev) => ({ ...prev, notifications: status }));
    return status;
  }, [privacyService]);

  const enableBiometricLock = useCallback(async () => {
    const success = await privacyService.authenticate(
      'Confirm your identity to enable biometric lock.',
    );
    if (!success) throw new Error('Biometric confirmation failed. Biometric lock was not enabled.');
    await savePrefs({ ...preferences, biometricLockEnabled: true });
  }, [privacyService, preferences, savePrefs]);

  const disableBiometricLock = useCallback(async () => {
    await savePrefs({ ...preferences, biometricLockEnabled: false });
  }, [preferences, savePrefs]);

  const unlockWithBiometric = useCallback(
    () => privacyService.authenticate('Unlock wayLoc'),
    [privacyService],
  );

  const refreshPermissions = useCallback(async () => {
    setPermissions(await privacyService.getPermissionsState());
  }, [privacyService]);

  const setDuressCode = useCallback(async (code: string) => {
    await saveDuressCode(code);
    setDuressCodeSet(true);
  }, []);

  const removeDuressCode = useCallback(async () => {
    await clearDuressCode();
    setDuressCodeSet(false);
  }, []);

  const verifyDuressCode = useCallback(async (code: string) => {
    const stored = await loadDuressCode();
    return stored !== null && stored === code;
  }, []);

  const value = useMemo<PrivacyContextValue>(
    () => ({
      locationStatus: permissions.location,
      locationBackgroundStatus: permissions.locationBackground,
      notificationStatus: permissions.notifications,
      biometricAvailable,
      biometricLockEnabled: preferences.biometricLockEnabled,
      isLoading,
      requestLocationPermission,
      requestNotificationPermission,
      enableBiometricLock,
      disableBiometricLock,
      unlockWithBiometric,
      refreshPermissions,
      duressCodeSet,
      setDuressCode,
      removeDuressCode,
      verifyDuressCode,
    }),
    [
      permissions,
      biometricAvailable,
      preferences.biometricLockEnabled,
      isLoading,
      requestLocationPermission,
      requestNotificationPermission,
      enableBiometricLock,
      disableBiometricLock,
      unlockWithBiometric,
      refreshPermissions,
      duressCodeSet,
      setDuressCode,
      removeDuressCode,
      verifyDuressCode,
    ],
  );


  return (
    <PrivacyContext.Provider value={value}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacyContext(): PrivacyContextValue {
  return useContext(PrivacyContext);
}
