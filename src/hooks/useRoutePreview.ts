import { useEffect, useState } from 'react';

import type { Coordinates } from '../models/Journey';
import type { TravelMode } from '../models/Place';
import type { RouteResult } from '../models/RouteResult';
import { useRoutingContext } from '../context/RoutingContext';
import { computeEta, formatDistance, formatDuration, formatEta } from '../models/RouteResult';

export interface RoutePreview {
  route: RouteResult | null;
  isLoading: boolean;
  /** Non-null when routing failed. The journey can still be started without it. */
  error: string | null;
  /** "1.4 km" */
  formattedDistance: string | null;
  /** "18 min" */
  formattedDuration: string | null;
  /** "15:22" — arrival time if the journey started now. */
  formattedEta: string | null;
  /** Arrival Date, for persisting alongside the journey. */
  eta: Date | null;
}

/**
 * Route, distance and ETA for screen 04, calculated before the journey
 * exists.
 *
 * Goes through RoutingContext's `previewRoute`, which is deliberately separate
 * from the live-journey calculation: a preview must not abort, or be aborted
 * by, the active journey's recalculation loop. Recalculates when the travel
 * mode changes, because the mode is the main thing the user is comparing on
 * screen 04.
 */
export function useRoutePreview(
  from: Coordinates | null,
  to: Coordinates | null,
  mode: TravelMode,
  /** Ask for per-leg steps. Only the Route screen's timeline needs them. */
  includeSteps = false,
): RoutePreview {
  const { previewRoute } = useRoutingContext();
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Primitive deps so a new-but-equal coordinates object doesn't re-request.
  const fromLat = from?.latitude ?? null;
  const fromLng = from?.longitude ?? null;
  const toLat = to?.latitude ?? null;
  const toLng = to?.longitude ?? null;

  useEffect(() => {
    if (fromLat === null || fromLng === null || toLat === null || toLng === null) {
      setRoute(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setIsLoading(true);
    setError(null);

    previewRoute(
      { latitude: fromLat, longitude: fromLng },
      { latitude: toLat, longitude: toLng },
      mode,
      controller.signal,
      { includeSteps },
    )
      .then((result) => {
        if (!active) return;
        setRoute(result);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (!active || (err as Error)?.name === 'AbortError') return;
        // The journey can still start without a route — only the ETA line and
        // the map preview degrade, so this is surfaced as a soft notice
        // rather than blocking the Start button.
        setError("We couldn't work out a route. You can still start — we'll keep following you.");
        setRoute(null);
        setIsLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [fromLat, fromLng, toLat, toLng, mode, includeSteps, previewRoute]);

  // Anchored to calculatedAt so the displayed arrival time doesn't drift on
  // every render the way `new Date()` would.
  const eta = route ? computeEta(route.durationSeconds, route.calculatedAt) : null;

  return {
    route,
    isLoading,
    error,
    formattedDistance: route ? formatDistance(route.distanceMeters) : null,
    formattedDuration: route ? formatDuration(route.durationSeconds) : null,
    formattedEta: eta ? formatEta(eta) : null,
    eta,
  };
}
