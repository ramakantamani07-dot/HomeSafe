import { requireOptionalNativeModule } from 'expo-modules-core';

/** One suggestion as MapKit gives it: "King's College Hospital" / "Denmark Hill, London". */
export interface NativeCompletion {
  title: string;
  subtitle: string;
}

export interface NativeResolvedPlace {
  name: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  postcode: string | null;
}

interface PlaceSearchNativeModule {
  complete(query: string, nearLatitude: number | null, nearLongitude: number | null): Promise<NativeCompletion[]>;
  resolve(
    title: string,
    subtitle: string,
    nearLatitude: number | null,
    nearLongitude: number | null,
  ): Promise<NativeResolvedPlace>;
}

/**
 * Optional on purpose: Apple-only, and absent on Android, on web and in Jest.
 * Callers check `isPlaceSearchAvailable` and use another provider instead.
 */
const native = requireOptionalNativeModule<PlaceSearchNativeModule>('PlaceSearch');

export const isPlaceSearchAvailable = native !== null;

type Near = { latitude: number; longitude: number } | null;

export function completePlaces(query: string, near: Near): Promise<NativeCompletion[]> {
  if (!native) return Promise.resolve([]);
  return native.complete(query, near?.latitude ?? null, near?.longitude ?? null);
}

export function resolvePlace(title: string, subtitle: string, near: Near): Promise<NativeResolvedPlace> {
  if (!native) return Promise.reject(new Error('Place search is not available on this device.'));
  return native.resolve(title, subtitle, near?.latitude ?? null, near?.longitude ?? null);
}
