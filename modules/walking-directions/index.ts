import { requireOptionalNativeModule } from 'expo-modules-core';

/** One leg as MapKit describes it — see WalkingDirectionsModule.swift. */
export interface NativeWalkingStep {
  /** MapKit's spoken instruction, e.g. "Turn right onto Rye Lane". */
  instructions: string;
  distanceMeters: number;
  startLatitude: number;
  startLongitude: number;
}

export interface NativeWalkingRoute {
  distanceMeters: number;
  durationSeconds: number;
  /** `[latitude, longitude]` pairs along the route. */
  coordinates: Array<[number, number]>;
  steps: NativeWalkingStep[];
}

interface WalkingDirectionsNativeModule {
  route(
    fromLatitude: number,
    fromLongitude: number,
    toLatitude: number,
    toLongitude: number,
    includeSteps: boolean,
  ): Promise<NativeWalkingRoute>;
}

/**
 * Optional on purpose: Apple-only, and absent on Android, on web and in Jest,
 * where `requireNativeModule` would throw at import. Callers check
 * `isWalkingDirectionsAvailable` and use another router instead.
 */
const native = requireOptionalNativeModule<WalkingDirectionsNativeModule>('WalkingDirections');

export const isWalkingDirectionsAvailable = native !== null;

export function walkingRoute(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  includeSteps: boolean,
): Promise<NativeWalkingRoute> {
  if (!native) return Promise.reject(new Error('Walking directions are not available on this device.'));
  return native.route(from.latitude, from.longitude, to.latitude, to.longitude, includeSteps);
}
