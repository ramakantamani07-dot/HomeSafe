import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { SOSEvent } from '../models/SOS';
import type { SOSService } from '../services/SOSService';
import { useAuthContext } from './AuthContext';
import { useJourneyContext } from './JourneyContext';
import { useLocationTrackingContext } from './LocationTrackingContext';

interface SOSContextValue {
  activeSOS: SOSEvent | null;
  isSOSLoading: boolean;
  triggerSOS(): Promise<void>;
  resolveSOS(): Promise<void>;
  /**
   * Duress ("fake") resolve: clears the alert from the local screen exactly
   * like a real resolve, but the underlying event stays ACTIVE and tracking
   * keeps running — see SOSService.triggerDuress.
   */
  triggerDuress(): Promise<void>;
}

const NOOP = async () => {};

export const SOSContext = createContext<SOSContextValue>({
  activeSOS: null,
  isSOSLoading: false,
  triggerSOS: NOOP,
  resolveSOS: NOOP,
  triggerDuress: NOOP,
});

export function SOSStateProvider({
  sosService,
  children,
}: {
  sosService: SOSService;
  children: React.ReactNode;
}) {
  const { user } = useAuthContext();
  const journeyCtx = useJourneyContext();
  const { activeJourney } = journeyCtx;
  const { currentLocation, setSosTracking } = useLocationTrackingContext();

  // Always-fresh ref so async callbacks see the latest context methods.
  const journeyCtxRef = useRef(journeyCtx);
  journeyCtxRef.current = journeyCtx;

  const [activeSOS, setActiveSOS] = useState<SOSEvent | null>(null);
  const [isSOSLoading, setIsSOSLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setActiveSOS(null);
      setIsSOSLoading(false);
      return;
    }

    let mounted = true;
    setIsSOSLoading(true);

    sosService
      .getActiveSOS(user.id)
      .then((sos) => { if (mounted) setActiveSOS(sos); })
      .catch(() => {})
      .finally(() => { if (mounted) setIsSOSLoading(false); });

    return () => { mounted = false; };
  }, [user?.id, sosService]);

  const userId = user?.id ?? null;

  const triggerSOS = useCallback(async (): Promise<void> => {
    if (!user?.id) return;
    const location = currentLocation ?? activeJourney?.startLocation ?? null;
    const journeyId = activeJourney?.id ?? null;

    // Enable high-accuracy SOS tracking BEFORE clearing the journey so the
    // location subscription stays alive (journey clearing would stop it otherwise).
    setSosTracking(true);
    const sos = await sosService.triggerSOS(user.id, journeyId, location);
    setActiveSOS(sos);
    // Clear the journey from local context so CheckIn timer stops.
    // Location tracking continues at SOS priority via setSosTracking(true) above.
    journeyCtxRef.current.clearJourneyForSOS();
  }, [userId, currentLocation, activeJourney, setSosTracking, sosService]);

  const resolveSOS = useCallback(async (): Promise<void> => {
    if (!user?.id || !activeSOS) return;
    await sosService.resolveSOS(user.id, activeSOS.id, activeSOS.journeyId);
    setSosTracking(false);
    setActiveSOS(null);
  }, [user?.id, activeSOS, setSosTracking, sosService]);

  const triggerDuress = useCallback(async (): Promise<void> => {
    if (!user?.id || !activeSOS) return;
    try {
      await sosService.triggerDuress(user.id, activeSOS.id);
    } catch {
      // Never surface — see SOSService.triggerDuress. The screen must look
      // exactly like a successful resolve either way.
    }
    // Deliberately do NOT call setSosTracking(false) and do NOT touch the
    // journey: location must keep flowing at SOS priority. Only the local
    // screen state changes, so the UI navigates home like a real resolve.
    setActiveSOS(null);
  }, [user?.id, activeSOS, sosService]);

  const value = useMemo<SOSContextValue>(
    () => ({ activeSOS, isSOSLoading, triggerSOS, resolveSOS, triggerDuress }),
    [activeSOS, isSOSLoading, triggerSOS, resolveSOS, triggerDuress],
  );

  return (
    <SOSContext.Provider value={value}>
      {children}
    </SOSContext.Provider>
  );
}

export function useSOSContext(): SOSContextValue {
  return useContext(SOSContext);
}
