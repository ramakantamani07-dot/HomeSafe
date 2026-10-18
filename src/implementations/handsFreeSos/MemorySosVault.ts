import type { SosVaultProvider } from '../../providers/HandsFreeSosProvider';

/** In memory, for tests and for platforms without the native vault. */
export class MemorySosVault implements SosVaultProvider {
  constructor(readonly available = true) {}
  stored: { keyId: string; key: string; endpoint: string; testUntil: number | null } | null = null;
  lastLocation: { latitude: number; longitude: number; observedAt: Date } | null = null;

  save(keyId: string, key: string, endpoint: string): boolean {
    this.stored = { keyId, key, endpoint, testUntil: null };
    return true;
  }
  keyId(): string | null {
    return this.stored?.keyId ?? null;
  }
  setTestUntil(untilEpochMs: number | null): boolean {
    if (!this.stored) return false;
    this.stored.testUntil = untilEpochMs;
    return true;
  }
  saveLastLocation(latitude: number, longitude: number, observedAt: Date): boolean {
    this.lastLocation = { latitude, longitude, observedAt };
    return true;
  }
  clear(): void {
    this.stored = null;
    this.lastLocation = null;
  }
}
