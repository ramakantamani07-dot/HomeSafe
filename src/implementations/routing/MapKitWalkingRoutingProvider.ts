import { walkingRoute, type NativeWalkingRoute } from '../../../modules/walking-directions';
import type { Coordinates } from '../../models/Journey';
import type { RouteResult, RouteStep } from '../../models/RouteResult';
import type { RouteRequestOptions, RoutingProvider } from '../../providers/RoutingProvider';

/**
 * Walking routes from Apple's MapKit — free, keyless, iOS only.
 *
 * Replaces OSRM on iOS, where the app was asking a volunteer demo server for
 * *driving* routes (docs/plan/IMPLEMENTATION_PHASES.md, "Walking routes").
 * Only the two coordinates go to Apple, the same as any Maps lookup.
 */
export class MapKitWalkingRoutingProvider implements RoutingProvider {
  async getRoute(
    from: Coordinates,
    to: Coordinates,
    signal?: AbortSignal,
    options: RouteRequestOptions = {},
  ): Promise<RouteResult> {
    throwIfAborted(signal);
    // MapKit cannot be cancelled mid-flight from JS; a superseded request is
    // dropped when it lands, which is what the port asks for.
    const native = await walkingRoute(from, to, options.includeSteps ?? false);
    throwIfAborted(signal);
    return toRouteResult(native, new Date());
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error('Route request was cancelled.');
    error.name = 'AbortError';
    throw error;
  }
}

/** MapKit's raw route as wayLoc's `RouteResult`. Pure, so it is tested. */
export function toRouteResult(native: NativeWalkingRoute, calculatedAt: Date): RouteResult {
  const total = native.distanceMeters;
  return {
    providerRouteId: null,
    coordinates: native.coordinates.map(([latitude, longitude]) => ({ latitude, longitude })),
    distanceMeters: native.distanceMeters,
    durationSeconds: native.durationSeconds,
    steps: native.steps.map(
      (step): RouteStep => ({
        name: roadName(step.instructions),
        distanceMeters: step.distanceMeters,
        // MapKit times the whole route, not each step. Share it out by
        // distance: at walking pace, time follows distance closely enough
        // for a timeline that says "roughly how long".
        durationSeconds: total > 0 ? (native.durationSeconds * step.distanceMeters) / total : 0,
        start: { latitude: step.startLatitude, longitude: step.startLongitude },
      }),
    ),
    calculatedAt,
  };
}

/**
 * The road a step is on, read from MapKit's instruction: "Turn right onto Rye
 * Lane" → "Rye Lane". Null when the instruction names no road ("Arrive at the
 * destination", or a language this does not read), so the timeline and turn
 * banner skip it rather than show a manoeuvre the app does not otherwise give.
 */
export function roadName(instructions: string): string | null {
  const match = /\b(?:onto|on|along|down|up|into|via)\s+(?:the\s+)?(.+?)\s*\.?$/i.exec(instructions.trim());
  if (!match) return null;
  const name = match[1].trim();
  // "Continue on the path" names nothing a person could look for, and "on
  // your left" is a side, not a road.
  if (/^(?:path|footpath|walkway|pedestrian (?:path|way)|road|street|route)$/i.test(name)) return null;
  if (/^(?:your\s+)?(?:left|right)$/i.test(name)) return null;
  return name || null;
}
