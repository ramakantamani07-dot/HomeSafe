import { useRoutingContext } from '../context/RoutingContext';
import type { RoutingContextValue } from '../context/RoutingContext';

export type { RoutingContextValue as RouteState };

/** Returns the current route calculation state including ETA and distance. */
export function useRoute(): RoutingContextValue {
  return useRoutingContext();
}
