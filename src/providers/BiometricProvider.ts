export type BiometricType = 'fingerprint' | 'faceId' | 'iris';

export interface BiometricProvider {
  /** True if the device has biometric hardware AND the user has enrolled credentials. */
  isAvailable(): Promise<boolean>;
  getSupportedTypes(): Promise<BiometricType[]>;
  /** Returns true on success, false on cancel/failure. Never throws for user-facing failures. */
  authenticate(reason: string): Promise<boolean>;
}
