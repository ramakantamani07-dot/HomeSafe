/** A key that can start an SOS for its owner and do nothing else (functions/src/sos). */
export interface SosKeyGrant {
  keyId: string;
  key: string;
}

/** The server half of hands-free SOS: issuing and revoking SOS keys. */
export interface HandsFreeSosProvider {
  registerKey(platform: 'ios' | 'android'): Promise<SosKeyGrant>;
  revokeKey(keyId: string): Promise<void>;
  /** Where the phone sends a hands-free SOS; '' when there is no backend (mock). */
  readonly endpoint: string;
}

/**
 * The phone half: where the SOS key and the last known position are kept so
 * the Siri extension can read them on a locked phone (iOS Keychain).
 */
export interface SosVaultProvider {
  readonly available: boolean;
  save(keyId: string, key: string, endpoint: string): boolean;
  /** The stored key's id, or null. Never the key. */
  keyId(): string | null;
  setTestUntil(untilEpochMs: number | null): boolean;
  saveLastLocation(latitude: number, longitude: number, observedAt: Date): boolean;
  clear(): void;
}
