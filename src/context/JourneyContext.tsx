import React, { createContext, useContext, useEffect, useState } from 'react';

import type { Journey } from '../models/Journey';
import type { JourneyService } from '../services/JourneyService';
import { useAuthContext } from './AuthContext';

interface JourneyContextValue {
  activeJourney: Journey | null;
  isLoading: boolean;
  startJourney(
    destinationLabel: string,
    checkInIntervalMinutes: number | null,
    destinationCoordinates?: import('../models/Journey').Coordinates | null,
  ): Promise<Journey>;
  endJourney(): Promise<void>;
  cancelJourney(): Promise<void>;
  missedCheckIn(): Promise<void>;
  /** Clears the local journey state when SOS is triggered. No Firestore write — SOSService handles that. */
  clearJourneyForSOS(): void;
}

export const JourneyContext = createContext<JourneyContextValue>({
  activeJourney: null,
  isLoading: false,
  startJourney: async () => { throw new Error('JourneyContext not mounted.'); },
  endJourney: async () => {},
  cancelJourney: async () => {},
  missedCheckIn: async () => {},
  clearJourneyForSOS: () => {},
});

export function JourneyStateProvider({
  journeyService,
  children,
}: {
  journeyService: JourneyService;
  children: React.ReactNode;
}) {
  const { user } = useAuthContext();
  const [activeJourney, setActiveJourney] = useState<Journey | null>(null);
  // Start as true so home and active-journey screens never flash wrong state
  // before the first fetch completes. Set to false when no user (no fetch needed).
  const [isLoading, setIsLoading] = useState(true);

  // Fetch or clear the active journey whenever the signed-in user changes.
  useEffect(() => {
    if (!user?.id) {
      setActiveJourney(null);
      setIsLoading(false);
      return;
    }

    let mounted = true;
    setIsLoading(true);

    journeyService
      .getActiveJourney(user.id)
      .then((j) => { if (mounted) setActiveJourney(j); })
      .catch(() => { /* leave null on failure */ })
      .finally(() => { if (mounted) setIsLoading(false); });

    return () => { mounted = false; };
  }, [user?.id, journeyService]);

  const value: JourneyContextValue = {
    activeJourney,
    isLoading,

    startJourney: async (
      destinationLabel: string,
      checkInIntervalMinutes: number | null,
      destinationCoordinates: import('../models/Journey').Coordinates | null = null,
    ): Promise<Journey> => {
      if (!user?.id) throw new Error('You must be signed in to start a journey.');
      const journey = await journeyService.startJourney(
        user.id,
        destinationLabel,
        checkInIntervalMinutes,
        destinationCoordinates,
      );
      setActiveJourney(journey);
      return journey;
    },

    endJourney: async (): Promise<void> => {
      if (!user?.id || !activeJourney) return;
      await journeyService.endJourney(user.id, activeJourney.id);
      setActiveJourney(null);
    },

    cancelJourney: async (): Promise<void> => {
      if (!user?.id || !activeJourney) return;
      await journeyService.cancelJourney(user.id, activeJourney.id);
      setActiveJourney(null);
    },

    missedCheckIn: async (): Promise<void> => {
      if (!user?.id || !activeJourney) return;
      await journeyService.missedCheckIn(user.id, activeJourney.id);
      setActiveJourney(null);
    },

    clearJourneyForSOS: (): void => {
      setActiveJourney(null);
    },
  };

  return (
    <JourneyContext.Provider value={value}>
      {children}
    </JourneyContext.Provider>
  );
}

export function useJourneyContext(): JourneyContextValue {
  return useContext(JourneyContext);
}
