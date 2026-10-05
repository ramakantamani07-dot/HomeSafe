import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { Journey } from '../models/Journey';
import type { JourneyPreferences } from '../models/JourneyPreferences';
import { DEFAULT_JOURNEY_PREFERENCES } from '../models/JourneyPreferences';
import { JourneyPreferencesStore } from '../implementations/journey/JourneyPreferencesStore';
import type { WalkRating } from '../models/WalkFeedback';
import type { WalkFeedbackProvider } from '../providers/WalkFeedbackProvider';
import type { JourneyService, StartJourneyOptions } from '../services/JourneyService';
import { useAuthContext } from './AuthContext';

interface JourneyContextValue {
  activeJourney: Journey | null;
  isLoading: boolean;
  startJourney(options: StartJourneyOptions): Promise<Journey>;
  /** Journey defaults from Settings — "Check on me if late". */
  journeyPreferences: JourneyPreferences;
  setJourneyPreferences(next: JourneyPreferences): Promise<void>;
  endJourney(): Promise<Journey | null>;
  cancelJourney(): Promise<void>;
  missedCheckIn(): Promise<void>;
  /** Clears the local journey state when SOS is triggered. No Firestore write — SOSService handles that. */
  clearJourneyForSOS(): void;
  /** Creates a public tracking link for a guardian without the app. Returns the full shareable URL. */
  shareJourney(): Promise<string>;
  /** Finished journeys, newest first. Fetched on demand by the Journeys tab. */
  listHistory(): Promise<Journey[]>;
  /**
   * Records how a finished journey felt (`AI6`). Private to the owner — never
   * surfaced to guardians, enforced in the Firestore rules.
   */
  saveWalkFeedback(journeyId: string, rating: WalkRating): Promise<void>;
  /**
   * Deletes the detailed location trail of every finished journey, keeping the
   * journey summaries. Used by Privacy & Security.
   */
  deleteLocationHistory(): Promise<{ processed: number; errors: string[] }>;
}

export const JourneyContext = createContext<JourneyContextValue>({
  activeJourney: null,
  isLoading: false,
  startJourney: async () => { throw new Error('JourneyContext not mounted.'); },
  journeyPreferences: DEFAULT_JOURNEY_PREFERENCES,
  setJourneyPreferences: async () => {},
  endJourney: async () => null,
  cancelJourney: async () => {},
  missedCheckIn: async () => {},
  clearJourneyForSOS: () => {},
  shareJourney: async () => { throw new Error('JourneyContext not mounted.'); },
  listHistory: async () => [],
  saveWalkFeedback: async () => {},
  deleteLocationHistory: async () => ({ processed: 0, errors: [] }),
});

export function JourneyStateProvider({
  journeyService,
  walkFeedbackProvider,
  children,
}: {
  journeyService: JourneyService;
  walkFeedbackProvider: WalkFeedbackProvider;
  children: React.ReactNode;
}) {
  const { user } = useAuthContext();
  const [activeJourney, setActiveJourney] = useState<Journey | null>(null);
  const [journeyPreferences, setPreferences] = useState<JourneyPreferences>(
    DEFAULT_JOURNEY_PREFERENCES,
  );
  // Start as true so home and active-journey screens never flash wrong state
  // before the first fetch completes. Set to false when no user (no fetch needed).
  const [isLoading, setIsLoading] = useState(true);

  // Device-local preferences — loaded once, independent of auth.
  useEffect(() => {
    let mounted = true;
    JourneyPreferencesStore.load()
      .then((prefs) => { if (mounted) setPreferences(prefs); })
      .catch(() => { /* defaults already in state */ });
    return () => { mounted = false; };
  }, []);

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

  const userId = user?.id ?? null;
  const userName = user?.name ?? '';

  const startJourney = useCallback(
    async (options: StartJourneyOptions): Promise<Journey> => {
      if (!userId) throw new Error('You must be signed in to start a journey.');
      const journey = await journeyService.startJourney(userId, {
        // Settings' "Check on me if late" becomes this journey's interval. The
        // caller can still override it explicitly; the preference is only the
        // default, and it is copied onto the journey at start so changing the
        // setting later never alters a journey already running.
        checkInIntervalMinutes: journeyPreferences.checkInIntervalMinutes,
        ...options,
      });
      setActiveJourney(journey);
      return journey;
    },
    [userId, journeyService, journeyPreferences],
  );

  const setJourneyPreferences = useCallback(async (next: JourneyPreferences) => {
    setPreferences(next);
    await JourneyPreferencesStore.save(next).catch(() => {
      // A failed write leaves the in-memory value applied for this session —
      // better than silently reverting a choice the user just made.
    });
  }, []);

  const endJourney = useCallback(async (): Promise<Journey | null> => {
    if (!userId || !activeJourney) return null;
    const ended = await journeyService.endJourney(userId, activeJourney.id);
    setActiveJourney(null);
    // The ended journey is returned so screen 10 can render its summary
    // (duration, distance, destination) after activeJourney goes null.
    // endJourney's offline path returns a synthetic journey with empty
    // fields, so fall back to the one we already had in memory.
    return ended.destinationLabel ? ended : activeJourney;
  }, [userId, activeJourney, journeyService]);

  const cancelJourney = useCallback(async (): Promise<void> => {
    if (!userId || !activeJourney) return;
    await journeyService.cancelJourney(userId, activeJourney.id);
    setActiveJourney(null);
  }, [userId, activeJourney, journeyService]);

  const missedCheckIn = useCallback(async (): Promise<void> => {
    if (!userId || !activeJourney) return;
    await journeyService.missedCheckIn(userId, activeJourney.id);
    setActiveJourney(null);
  }, [userId, activeJourney, journeyService]);

  const clearJourneyForSOS = useCallback((): void => {
    setActiveJourney(null);
  }, []);

  // Stable across active-journey changes on purpose: the Journeys tab calls
  // this from a focus effect, and an identity that churned would refetch the
  // whole history every time a journey started or ended.
  const listHistory = useCallback(async (): Promise<Journey[]> => {
    if (!userId) return [];
    return journeyService.listHistory(userId);
  }, [userId, journeyService]);

  const saveWalkFeedback = useCallback(
    async (journeyId: string, rating: WalkRating) => {
      if (!userId) return;
      await walkFeedbackProvider.saveFeedback(userId, journeyId, rating);
    },
    [userId, walkFeedbackProvider],
  );

  const deleteLocationHistory = useCallback(async () => {
    if (!userId) return { processed: 0, errors: [] };
    return journeyService.deleteJourneyHistory(userId);
  }, [userId, journeyService]);

  const shareJourney = useCallback(async (): Promise<string> => {
    if (!userId || !activeJourney) throw new Error('No active journey to share.');
    return journeyService.createShareLink(userId, activeJourney.id, userName);
  }, [userId, userName, activeJourney, journeyService]);

  const value = useMemo<JourneyContextValue>(
    () => ({
      activeJourney,
      isLoading,
      startJourney,
      journeyPreferences,
      setJourneyPreferences,
      endJourney,
      cancelJourney,
      missedCheckIn,
      clearJourneyForSOS,
      listHistory,
      saveWalkFeedback,
      deleteLocationHistory,
      shareJourney,
    }),
    [
      activeJourney,
      isLoading,
      startJourney,
      journeyPreferences,
      setJourneyPreferences,
      endJourney,
      cancelJourney,
      missedCheckIn,
      clearJourneyForSOS,
      listHistory,
      saveWalkFeedback,
      deleteLocationHistory,
      shareJourney,
    ],
  );

  return (
    <JourneyContext.Provider value={value}>
      {children}
    </JourneyContext.Provider>
  );
}

export function useJourneyContext(): JourneyContextValue {
  return useContext(JourneyContext);
}
