/**
 * Platform-aware secure key-value storage.
 *
 * - Native (iOS/Android): delegates to expo-secure-store (hardware-backed).
 * - Web (Expo Go on browser / localhost dev): falls back to localStorage.
 *   localStorage is NOT secure, but the web target is development-only;
 *   production builds are iOS/Android where SecureStore is always used.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// localStorage is available on web but not in RN's TypeScript lib set.
// Accessed via globalThis so the types stay narrowly scoped to this file.
type WebStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const webStorage = (globalThis as unknown as { localStorage: WebStorage }).localStorage;

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return webStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage.setItem(key, value);
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage.removeItem(key);
    return;
  }
  return SecureStore.deleteItemAsync(key);
}
