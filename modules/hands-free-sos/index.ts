import { requireOptionalNativeModule } from 'expo-modules-core';

interface HandsFreeSosNativeModule {
  saveCredentials(keyId: string, key: string, endpoint: string): boolean;
  credentialsKeyId(): string | null;
  setTestUntil(untilEpochMs: number | null): boolean;
  saveLastLocation(latitude: number, longitude: number, observedAt: string): boolean;
  clear(): void;
}

/**
 * Optional on purpose: iPhone only for now (Siri), absent on Android, web and
 * in Jest. Callers check `isHandsFreeSosAvailable`.
 */
const native = requireOptionalNativeModule<HandsFreeSosNativeModule>('HandsFreeSos');

export const isHandsFreeSosAvailable = native !== null;

export const handsFreeSosNative = {
  saveCredentials: (keyId: string, key: string, endpoint: string) => native?.saveCredentials(keyId, key, endpoint) ?? false,
  credentialsKeyId: () => native?.credentialsKeyId() ?? null,
  setTestUntil: (untilEpochMs: number | null) => native?.setTestUntil(untilEpochMs) ?? false,
  saveLastLocation: (latitude: number, longitude: number, observedAt: Date) =>
    native?.saveLastLocation(latitude, longitude, observedAt.toISOString()) ?? false,
  clear: () => native?.clear(),
};
