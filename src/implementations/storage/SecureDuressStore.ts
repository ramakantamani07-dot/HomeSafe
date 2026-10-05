import { SECURE_STORE_KEYS } from '../../config/constants';
import { getItem, setItem, removeItem } from './secureStorage';

export function isValidDuressCode(code: string): boolean {
  return /^\d{4,6}$/.test(code);
}

/** Returns the stored duress code, or null if none has been set. */
export async function loadDuressCode(): Promise<string | null> {
  return getItem(SECURE_STORE_KEYS.duressCode);
}

// Stored directly (not hashed) the same way the auth session token is —
// SecureStore is already hardware-backed encryption at rest (Keychain/
// Keystore), so there's no separate secret store to protect against here,
// and hashing would need a new crypto dependency for no real gain.
export async function saveDuressCode(code: string): Promise<void> {
  await setItem(SECURE_STORE_KEYS.duressCode, code);
}

export async function clearDuressCode(): Promise<void> {
  await removeItem(SECURE_STORE_KEYS.duressCode);
}
