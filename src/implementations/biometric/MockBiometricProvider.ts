import type { BiometricProvider, BiometricType } from '../../providers/BiometricProvider';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Dev-mode biometric provider.
 * Always reports available and always authenticates successfully without a UI prompt.
 */
export class MockBiometricProvider implements BiometricProvider {
  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getSupportedTypes(): Promise<BiometricType[]> {
    return ['fingerprint'];
  }

  async authenticate(_reason: string): Promise<boolean> {
    await delay(600);
    return true;
  }
}
