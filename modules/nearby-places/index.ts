import { requireOptionalNativeModule } from 'expo-modules-core';

/** One result from MapKit. Deliberately has no "open now" — see NearbyPlacesModule.swift. */
export interface NativeNearbyPlace {
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  phoneNumber: string | null;
  distanceMeters: number;
}

interface NearbyPlacesNativeModule {
  search(
    categories: string[],
    latitude: number,
    longitude: number,
    radiusMeters: number,
    limit: number,
  ): Promise<NativeNearbyPlace[]>;
}

/**
 * Optional on purpose: this module is Apple-only, and is absent on Android, on
 * web, and in Jest. `requireNativeModule` would throw at import time in all
 * three; callers check for null instead and fall back.
 */
const native = requireOptionalNativeModule<NearbyPlacesNativeModule>('NearbyPlaces');

export const isNearbyPlacesAvailable = native !== null;

export async function searchNearby(
  categories: string[],
  latitude: number,
  longitude: number,
  radiusMeters: number,
  limit: number,
): Promise<NativeNearbyPlace[]> {
  if (!native) return [];
  return native.search(categories, latitude, longitude, radiusMeters, limit);
}
