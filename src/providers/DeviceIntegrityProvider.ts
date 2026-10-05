export interface DeviceIntegrityResult {
  isCompromised: boolean;
  reasons: string[];
}

export interface DeviceIntegrityProvider {
  /** Best-effort jailbreak/root/hook detection. Never throws — an
   * inconclusive check (e.g. native module unavailable) reports "not
   * compromised" rather than blocking a safety-critical app on a guess. */
  checkIntegrity(): Promise<DeviceIntegrityResult>;
}
