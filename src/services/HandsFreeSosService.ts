import type { HandsFreeSosProvider, SosVaultProvider } from '../providers/HandsFreeSosProvider';
import { TEST_WINDOW_MS, shouldSaveLocation } from '../models/HandsFreeSos';

export class HandsFreeSosUnavailableError extends Error {
  constructor() {
    super('Hands-free SOS needs Siri, which this phone does not offer to WayLoc.');
    this.name = 'HandsFreeSosUnavailableError';
  }
}

/**
 * Turns hands-free SOS on and off for this phone, and keeps the last known
 * position where Siri can use it. The SOS itself is sent by the Siri
 * extension; this only prepares it.
 */
export class HandsFreeSosService {
  private lastLocationSavedAt: number | null = null;

  constructor(
    private readonly server: HandsFreeSosProvider,
    private readonly vault: SosVaultProvider,
  ) {}

  get available(): boolean {
    return this.vault.available;
  }

  isEnabled(): boolean {
    return this.vault.available && this.vault.keyId() !== null;
  }

  async enable(platform: 'ios' | 'android' = 'ios'): Promise<void> {
    if (!this.vault.available) throw new HandsFreeSosUnavailableError();
    // Replacing an existing key: revoke the old one rather than leave it live.
    const previous = this.vault.keyId();
    const grant = await this.server.registerKey(platform);
    if (!this.vault.save(grant.keyId, grant.key, this.server.endpoint)) {
      await this.server.revokeKey(grant.keyId).catch(() => {});
      throw new Error("Couldn't store the SOS key on this phone. Try again.");
    }
    if (previous && previous !== grant.keyId) await this.server.revokeKey(previous).catch(() => {});
  }

  /**
   * Off: the key leaves the phone first — that takes effect at once, even
   * offline — then the server is told. A failed revocation leaves a key that
   * nobody holds.
   */
  async disable(): Promise<void> {
    const keyId = this.vault.keyId();
    this.vault.clear();
    this.lastLocationSavedAt = null;
    if (keyId) await this.server.revokeKey(keyId).catch(() => {});
  }

  /** Signed out: wipe the phone's copy. Revocation needs the session, so the caller does it first. */
  forgetLocally(): void {
    this.vault.clear();
    this.lastLocationSavedAt = null;
  }

  /** Siri triggers alert nobody for the next ten minutes. */
  startTest(now = Date.now()): boolean {
    return this.vault.setTestUntil(now + TEST_WINDOW_MS);
  }

  endTest(): boolean {
    return this.vault.setTestUntil(null);
  }

  /** Saves the last position for Siri, at most once a minute. */
  recordLocation(latitude: number, longitude: number, at: Date): void {
    if (!this.isEnabled()) return;
    if (!shouldSaveLocation(this.lastLocationSavedAt, at.getTime())) return;
    if (this.vault.saveLastLocation(latitude, longitude, at)) this.lastLocationSavedAt = at.getTime();
  }
}
