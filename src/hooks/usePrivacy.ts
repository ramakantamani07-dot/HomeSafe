import { usePrivacyContext } from '../context/PrivacyContext';

/**
 * Primary privacy hook for screens.
 * Covers OS permissions (location, notifications) and device security (biometric lock).
 * Screens must not import PrivacyService, PermissionProvider, or BiometricProvider directly.
 */
export function usePrivacy() {
  return usePrivacyContext();
}
