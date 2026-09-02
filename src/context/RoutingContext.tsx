import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

import type { RouteResult } from '../models/RouteResult';
import type { RoutingService } from '../services/RoutingService';
import type { JourneyService } from '../services/JourneyService';
import { useJourney } from '../hooks/useJourney';
import { useActiveJourneyLocation } from '../hooks/useActiveJourneyLocation';

export interface RoutingContextValue {
  route: RouteResult | null;
  isLoading: boolean;
  /** Non-null when the most recent route calculation failed. Journey continues. */
  error: string | null;
  /** Estimated arrival time derived from the current route. Null when no route. */
  eta: Date | null;
  /** e.g. "14:35" */
  formattedEta: string;
  /** e.g. "3.2 km" */
  formattedDistance: string;
  /** e.g. "7 min" */
  formattedDuration: string;
}

const RoutingContext = createContext<RoutingContextValue>({
  route: null,
  isLoading: false,
  error: null,
  eta: null,
  formattedEta: '—',
  formattedDistance: '—',
  formattedDuration: '—',
});

export function RoutingStateProvider({
  routingService,
  journeyService,
  children,
}: {
  routingService: RoutingService;
  journeyService: JourneyService;
  children: React.ReactNode;
}) {
  const { activeJourney } = useJourney();
  const { currentLocation } = useActiveJourneyLocation();

  const [route, setRoute] = useState<RouteResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable ref so the off-route effect always reads the latest route without
  // needing it as a dependency (which would re-subscribe on every update).
  const routeRef = useRef<RouteResult | null>(null);
  routeRef.current = route;

  // Prevents concurrent off-route recalculations
  const isRecalculating = useRef(false);

  // Primitive deps to avoid object-equality re-runs
  const journeyId = activeJourney?.id ?? null;
  const destLat = activeJourney?.destinationCoordinates?.latitude ?? null;
  const destLng = activeJourney?.destinationCoordinates?.longitude ?? null;

  // ── Effect 1: calculate route when the journey starts or destination changes ──
  useEffect(() => {
    const dest = activeJourney?.destinationCoordinates ?? null;
    const start = activeJourney?.startLocation ?? null;
    const jId = activeJourney?.id ?? null;
    const userId = activeJourney?.userId ?? null;

    if (!dest || !start || !jId || !userId) {
      routingService.cancelPendingRequest();
      setRoute(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    void routingService
      .calculateRoute(start, dest)
      .then((result) => {
        if (!active) return;
        setRoute(result);
        setIsLoading(false);
        // Persist route summary to the journey document (best-effort).
        // Anchor ETA to calculatedAt so the stored value is stable.
        const eta = routingService.computeEta(result.durationSeconds, result.calculatedAt);
        void journeyService
          .saveRouteData(userId, jId, result.distanceMeters, result.durationSeconds, eta)
          .catch(() => {});
      })
      .catch((err: unknown) => {
        if (!active) return;
        if ((err as Error)?.name === 'AbortError') return;
        setError((err as Error)?.message ?? 'Route calculation failed');
        setIsLoading(false);
        // Journey continues — route stays null
      });

    return () => {
      active = false;
      routingService.cancelPendingRequest();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyId, destLat, destLng, routingService, journeyService]);

  // ── Effect 2: recalculate when the user goes off-route or the route is stale ──
  useEffect(() => {
    if (!currentLocation || destLat === null || destLng === null) return;
    const dest = { latitude: destLat, longitude: destLng };
    const currentRoute = routeRef.current;
    if (!currentRoute) return;
    if (isRecalculating.current) return;
    if (routingService.isOnCooldown()) return;

    const needsRecalc =
      routingService.isOffRoute(currentLocation, currentRoute) ||
      routingService.isStale(currentRoute);
    if (!needsRecalc) return;

    isRecalculating.current = true;

    void routingService
      .calculateRoute(currentLocation, dest)
      .then((result) => {
        setRoute(result);
      })
      .catch(() => {
        // Silently keep the existing route — do not surface an error for
        // background recalculations.
      })
      .finally(() => {
        isRecalculating.current = false;
      });
  }, [currentLocation, routingService, destLat, destLng]);

  // ── Derived values ────────────────────────────────────────────────────────
  // Anchor ETA to calculatedAt — otherwise new Date() on every render drifts the arrival time.
  const eta = route ? routingService.computeEta(route.durationSeconds, route.calculatedAt) : null;
  const formattedEta = eta ? routingService.formatEta(eta) : '—';
  const formattedDistance = route
    ? routingService.formatDistance(route.distanceMeters)
    : '—';
  const formattedDuration = route
    ? routingService.formatDuration(route.durationSeconds)
    : '—';

  return (
    <RoutingContext.Provider
      value={{ route, isLoading, error, eta, formattedEta, formattedDistance, formattedDuration }}
    >
      {children}
    </RoutingContext.Provider>
  );
}

export function useRoutingContext(): RoutingContextValue {
  return useContext(RoutingContext);
}
