import * as LocalAuthentication from 'expo-local-authentication';

import type { BiometricProvider, BiometricType } from '../../providers/BiometricProvider';

function mapAuthType(type: LocalAuthentication.AuthenticationType): BiometricType {
  if (type === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) return 'faceId';
  if (type === LocalAuthentication.AuthenticationType.IRIS) return 'iris';
  return 'fingerprint';
}

export class ExpoBiometricProvider implements BiometricProvider {
  async isAvailable(): Promise<boolean> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    return LocalAuthentication.isEnrolledAsync();
  }

  async getSupportedTypes(): Promise<BiometricType[]> {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return types.map(mapAuthType);
  }

  async authenticate(reason: string): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      return result.success;
    } catch {
      return false;
    }
  }
}
