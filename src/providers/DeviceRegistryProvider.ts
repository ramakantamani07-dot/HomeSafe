/**
 * The account's list of phones (account protection, docs/reference/ACCOUNT_PROTECTION.md).
 *
 * Each installation records itself once under its own id. The server warns
 * the account's other phones and its family the first time a new id appears
 * (`onDeviceRegistered`). Write-only from the app: the list cannot be read or
 * pruned from a phone, so whoever holds the account cannot hide a new sign-in.
 */
export interface DeviceRegistryProvider {
  /**
   * Records this installation for `userId`, with its push token when there is
   * one. Safe to call on every launch: an existing record is refreshed, and
   * only the first call for an installation can set off the warning.
   */
  register(userId: string, pushToken: string | null): Promise<void>;
}
