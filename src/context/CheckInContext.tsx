import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { CheckIn } from '../models/CheckIn';
import { GRACE_PERIOD_MINUTES } from '../models/CheckIn';
import type { CheckInService } from '../services/CheckInService';
import { useAuthContext } from './AuthContext';
import { useJourneyContext } from './JourneyContext';

export type CheckInPhase = 'inactive' | 'countdown' | 'prompt' | 'missed';

interface CheckInContextValue {
  phase: CheckInPhase;
  timeRemainingSeconds: number;
  graceRemainingSeconds: number;
  currentCheckIn: CheckIn | null;
  confirmSafe(): Promise<void>;
  extendTimer(byMinutes: number): Promise<void>;
}

const NOOP = async () => {};

export const CheckInContext = createContext<CheckInContextValue>({
  phase: 'inactive',
  timeRemainingSeconds: 0,
  graceRemainingSeconds: 0,
  currentCheckIn: null,
  confirmSafe: NOOP,
  extendTimer: NOOP,
});

export function CheckInStateProvider({
  checkInService,
  children,
}: {
  checkInService: CheckInService;
  children: React.ReactNode;
}) {
  const { user } = useAuthContext();
  const journeyCtx = useJourneyContext();
  const { activeJourney } = journeyCtx;

  // Always-fresh ref — lets async callbacks inside setInterval call missedCheckIn()
  // without capturing a stale closure.
  const journeyCtxRef = useRef(journeyCtx);
  journeyCtxRef.current = journeyCtx;

  const [phase, setPhase] = useState<CheckInPhase>('inactive');
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(0);
  const [graceRemainingSeconds, setGraceRemainingSeconds] = useState(0);
  const [currentCheckIn, setCurrentCheckIn] = useState<CheckIn | null>(null);

  // Refs used inside setInterval to avoid stale closures
  const phaseRef = useRef<CheckInPhase>('inactive');
  const currentCheckInRef = useRef<CheckIn | null>(null);
  const localNextCheckInAtRef = useRef<Date | null>(null);
  const graceStartedAtRef = useRef<Date | null>(null);
  // Prevents overlapping async ops (Firestore calls) inside the tick
  const pendingRef = useRef(false);

  // Keep currentCheckIn ref in sync with state so tick callbacks see latest value
  currentCheckInRef.current = currentCheckIn;

  useEffect(() => {
    const journeyId = activeJourney?.id;
    const userId = user?.id;
    const intervalMinutes = activeJourney?.checkInIntervalMinutes;

    if (!userId || !journeyId || activeJourney?.status !== 'ACTIVE' || !intervalMinutes) {
      phaseRef.current = 'inactive';
      setPhase('inactive');
      setTimeRemainingSeconds(0);
      setGraceRemainingSeconds(0);
      setCurrentCheckIn(null);
      return;
    }

    localNextCheckInAtRef.current = activeJourney.nextCheckInAt;
    pendingRef.current = false;
    let cancelled = false;

    const updatePhaseAndRef = (p: CheckInPhase) => {
      phaseRef.current = p;
      setPhase(p);
    };

    // On mount, recover from a restart where the timer may have already fired
    const now = new Date();
    const nextAt = localNextCheckInAtRef.current;
    if (nextAt) {
      const msUntil = nextAt.getTime() - now.getTime();
      if (msUntil <= 0) {
        const overdueMs = -msUntil;
        const graceMs = GRACE_PERIOD_MINUTES * 60_000;
        if (overdueMs >= graceMs) {
          // Grace period fully elapsed while the app was closed.
          // Update Firestore and journey context immediately — don't wait for the tick.
          updatePhaseAndRef('missed');
          checkInService
            .getLatestCheckIn(userId, journeyId)
            .then((c) => checkInService.missCheckIn(userId, journeyId, c?.id ?? null))
            .then(() => { if (!cancelled) journeyCtxRef.current.missedCheckIn(); })
            .catch(() => {});
        } else {
          // Backdate grace start so remaining time reflects real elapsed time.
          graceStartedAtRef.current = new Date(now.getTime() - overdueMs);
          updatePhaseAndRef('prompt');
          setGraceRemainingSeconds(Math.ceil((graceMs - overdueMs) / 1_000));
          // Fetch the PENDING check-in created when the timer originally fired so
          // that its ID is available if/when the grace period expires.
          checkInService
            .getLatestCheckIn(userId, journeyId)
            .then((c) => {
              if (!cancelled && c) {
                currentCheckInRef.current = c;
                setCurrentCheckIn(c);
              }
            })
            .catch(() => {});
        }
      } else {
        updatePhaseAndRef('countdown');
        setTimeRemainingSeconds(Math.ceil(msUntil / 1_000));
      }
    }

    const timerId = setInterval(() => {
      const tickNow = new Date();
      const currentPhase = phaseRef.current;

      if (currentPhase === 'inactive' || currentPhase === 'missed') return;

      if (currentPhase === 'countdown') {
        const target = localNextCheckInAtRef.current;
        if (!target) {
          updatePhaseAndRef('inactive');
          return;
        }
        const msLeft = target.getTime() - tickNow.getTime();
        if (msLeft > 1_000) {
          setTimeRemainingSeconds(Math.ceil(msLeft / 1_000));
        } else {
          // Timer fired — transition to prompt
          if (pendingRef.current) return;
          pendingRef.current = true;
          graceStartedAtRef.current = tickNow;
          updatePhaseAndRef('prompt');
          setGraceRemainingSeconds(GRACE_PERIOD_MINUTES * 60);
          setTimeRemainingSeconds(0);

          checkInService
            .scheduleCheckIn(userId, journeyId, target)
            .then((c) => {
              if (!cancelled) {
                currentCheckInRef.current = c;
                setCurrentCheckIn(c);
              }
            })
            .catch(() => { /* proceed without a persisted record */ })
            .finally(() => { pendingRef.current = false; });
        }
      } else if (currentPhase === 'prompt') {
        const graceStarted = graceStartedAtRef.current;
        if (!graceStarted) return;
        const graceMs = GRACE_PERIOD_MINUTES * 60_000;
        const elapsed = tickNow.getTime() - graceStarted.getTime();
        const remaining = graceMs - elapsed;
        if (remaining > 1_000) {
          setGraceRemainingSeconds(Math.ceil(remaining / 1_000));
        } else {
          // Grace period expired — missed
          if (pendingRef.current) return;
          pendingRef.current = true;
          updatePhaseAndRef('missed');
          setGraceRemainingSeconds(0);

          const checkInId = currentCheckInRef.current?.id ?? null;
          checkInService
            .missCheckIn(userId, journeyId, checkInId)
            .then(() => { if (!cancelled) journeyCtxRef.current.missedCheckIn(); })
            .catch(() => {})
            .finally(() => { pendingRef.current = false; });
        }
      }
    }, 1_000);

    return () => { cancelled = true; clearInterval(timerId); };
  // Re-run when the journey starts, ends, or its interval changes.
  // Deliberately excludes nextCheckInAt — that is managed locally via localNextCheckInAtRef.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activeJourney?.id, activeJourney?.checkInIntervalMinutes, activeJourney?.status, checkInService]);

  const confirmSafe = async (): Promise<void> => {
    if (!user?.id || !activeJourney?.id || !activeJourney.checkInIntervalMinutes) return;
    if (pendingRef.current) return;
    pendingRef.current = true;
    try {
      const newNextAt = await checkInService.confirmSafe(
        user.id,
        activeJourney.id,
        currentCheckIn?.id ?? null,
        activeJourney.checkInIntervalMinutes,
      );
      localNextCheckInAtRef.current = newNextAt;
      currentCheckInRef.current = null;
      graceStartedAtRef.current = null;
      setCurrentCheckIn(null);
      phaseRef.current = 'countdown';
      setPhase('countdown');
      setTimeRemainingSeconds(Math.ceil((newNextAt.getTime() - Date.now()) / 1_000));
    } finally {
      pendingRef.current = false;
    }
  };

  const extendTimer = async (byMinutes: number): Promise<void> => {
    if (!user?.id || !activeJourney?.id) return;
    if (pendingRef.current) return;
    pendingRef.current = true;
    try {
      const newNextAt = await checkInService.extendCheckIn(
        user.id,
        activeJourney.id,
        currentCheckIn?.id ?? null,
        byMinutes,
      );
      localNextCheckInAtRef.current = newNextAt;
      currentCheckInRef.current = null;
      graceStartedAtRef.current = null;
      setCurrentCheckIn(null);
      phaseRef.current = 'countdown';
      setPhase('countdown');
      setTimeRemainingSeconds(Math.ceil((newNextAt.getTime() - Date.now()) / 1_000));
    } finally {
      pendingRef.current = false;
    }
  };

  const value: CheckInContextValue = {
    phase,
    timeRemainingSeconds,
    graceRemainingSeconds,
    currentCheckIn,
    confirmSafe,
    extendTimer,
  };

  return (
    <CheckInContext.Provider value={value}>
      {children}
    </CheckInContext.Provider>
  );
}

export function useCheckInContext(): CheckInContextValue {
  return useContext(CheckInContext);
}
