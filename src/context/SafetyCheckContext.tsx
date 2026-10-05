import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';

import type { SafetyCheckReason } from '../models/AlertRules';
import type { SafetyCheck } from '../models/SafetyCheck';
import {
  SAFETY_CHECK_COOLDOWN_MINUTES,
  SAFETY_CHECK_EXTENSION_MINUTES,
  SAFETY_CHECK_NOTIFICATION_CATEGORY,
  SAFETY_CHECK_NOTIFICATION_ID,
  SAMPLE_RETENTION_MS,
} from '../models/SafetyCheck';
import { haversineMeters } from '../models/Place';
import type { PositionSample, SafetyCheckService } from '../services/SafetyCheckService';
import { useInterval } from '../hooks/useInterval';
import { useAuthContext } from './AuthContext';
import { useJourneyContext } from './JourneyContext';
import { useLocationTrackingContext } from './LocationTrackingContext';
import { useBatteryContext } from './BatteryContext';
import { useRoutingContext } from './RoutingContext';

interface SafetyCheckContextValue {
  /** Non-null while screen 08 should be showing. */
  activeCheck: SafetyCheck | null;
  /** Why it was raised. */
  reason: SafetyCheckReason | null;
  /** Seconds until guardians are alerted. Derived from a deadline, not counted down. */
  secondsUntilEscalation: number;
  /** True once guardians have been alerted for the current check. */
  hasEscalated: boolean;
  confirmOk(): Promise<void>;
  addTime(): Promise<void>;
  /** The ETA the late-detector measures against, including any added time. */
  adjustedEta: Date | null;
}

const notMounted = async () => {};

const SafetyCheckContext = createContext<SafetyCheckContextValue>({
  activeCheck: null,
  reason: null,
  secondsUntilEscalation: 0,
  hasEscalated: false,
  confirmOk: notMounted,
  addTime: notMounted,
  adjustedEta: null,
});

/**
 * Safety-net cadence for the detector.
 *
 * Detection is primarily driven by *arriving location samples* — a new fix is
 * the only thing that can change the answer, so running on a fixed timer in
 * between is wasted wakeups. This slow interval exists solely for the one case
 * samples can't cover: "late" becomes true through the passage of time alone,
 * with the traveller sitting still and their phone reporting nothing new.
 */
const DETECT_SAFETY_NET_MS = 60_000;

/**
 * Screen 08's engine: watches an active journey for "late", "stopped" and
 * "off route", raises a safety check, and alerts guardians if it goes
 * unanswered.
 *
 * Crucially, escalation does NOT end the journey. Guardians are told *because*
 * they need the live location only a running journey provides — ending it at
 * the moment of concern would be exactly backwards.
 */
export function SafetyCheckStateProvider({
  safetyCheckService,
  children,
}: {
  safetyCheckService: SafetyCheckService;
  children: React.ReactNode;
}) {
  const { user } = useAuthContext();
  const { activeJourney } = useJourneyContext();
  const { currentLocation } = useLocationTrackingContext();
  // Percent, not the 0–1 fraction: this value is written to the safety check as
  // `batteryPercent` and reaches guardians in the escalation alert.
  const { batteryPercent } = useBatteryContext();
  const { route, eta } = useRoutingContext();

  const [activeCheck, setActiveCheck] = useState<SafetyCheck | null>(null);
  const [secondsUntilEscalation, setSecondsUntilEscalation] = useState(0);
  const [hasEscalated, setHasEscalated] = useState(false);
  const [extraMinutes, setExtraMinutes] = useState(0);

  const samplesRef = useRef<PositionSample[]>([]);
  const lastCheckEndedAtRef = useRef<Date | null>(null);
  const raisingRef = useRef(false);
  const escalatingRef = useRef(false);

  /**
   * When guardians get alerted, as an absolute timestamp.
   *
   * Deliberately a deadline rather than a counter being decremented each
   * second. A counter only advances while the JS thread is running, so
   * backgrounding the app — the single most likely thing to happen when
   * someone's phone is in a pocket, which is exactly the scenario this feature
   * exists for — would silently freeze the countdown and guardians would never
   * be told. A deadline is correct no matter how long the runtime was asleep.
   */
  const escalateAtRef = useRef<number | null>(null);

  const userId = user?.id ?? null;
  const journeyId = activeJourney?.status === 'ACTIVE' ? activeJourney.id : null;
  const rules = activeJourney?.alertRules ?? null;

  // Read by callbacks that must not re-subscribe when these change.
  const latestRef = useRef({ route, eta, currentLocation, batteryPercent, rules, extraMinutes });
  latestRef.current = { route, eta, currentLocation, batteryPercent, rules, extraMinutes };

  const adjustedEta = useMemo(
    () => (eta ? new Date(eta.getTime() + extraMinutes * 60_000) : null),
    [eta, extraMinutes],
  );

  // ── Reset when the journey changes ────────────────────────────────────────
  useEffect(() => {
    samplesRef.current = [];
    lastCheckEndedAtRef.current = null;
    escalateAtRef.current = null;
    setActiveCheck(null);
    setHasEscalated(false);
    setSecondsUntilEscalation(0);
    setExtraMinutes(0);
  }, [journeyId]);

  // ── Escalation: fires on a deadline, from wherever JS next runs ───────────
  const maybeEscalate = useCallback(() => {
    const deadline = escalateAtRef.current;
    if (deadline === null || escalatingRef.current) return;
    if (!userId || !journeyId || !activeCheck) return;

    const remainingMs = deadline - Date.now();
    if (remainingMs > 0) {
      setSecondsUntilEscalation(Math.ceil(remainingMs / 1_000));
      return;
    }

    setSecondsUntilEscalation(0);
    escalatingRef.current = true;
    const { currentLocation: here, batteryPercent: battery } = latestRef.current;

    void safetyCheckService
      .escalate(userId, journeyId, activeCheck.id, here, battery)
      .catch(() => {
        // The write is the thing that alerts guardians. If it failed we are
        // past the deadline with nobody told, so leave the deadline in place
        // and let the next tick retry rather than marking this escalated.
        escalateAtRef.current = Date.now();
      })
      .then(() => {
        if (escalateAtRef.current !== null && escalateAtRef.current <= Date.now()) {
          setHasEscalated(true);
          escalateAtRef.current = null;
        }
      })
      .finally(() => {
        escalatingRef.current = false;
      });
  }, [userId, journeyId, activeCheck, safetyCheckService]);

  // Display tick. Pauses in the background by design — nothing depends on it,
  // because `maybeEscalate` reads the deadline rather than this counter.
  useInterval(maybeEscalate, activeCheck && !hasEscalated ? 1_000 : null);

  // Returning to the foreground is the moment a frozen countdown would have
  // been wrong, so re-check the deadline immediately rather than waiting for
  // the next tick.
  useEffect(() => {
    if (!activeCheck || hasEscalated) return;
    const onChange = (next: AppStateStatus) => {
      if (next === 'active') maybeEscalate();
    };
    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, [activeCheck, hasEscalated, maybeEscalate]);

  // ── Detection ─────────────────────────────────────────────────────────────
  const runDetection = useCallback(() => {
    const { rules: currentRules, route: currentRoute, currentLocation: here } = latestRef.current;
    if (!userId || !journeyId || !currentRules) return;
    // One check at a time, and never during the cooldown after the last one.
    if (activeCheck || raisingRef.current) return;

    const lastEnded = lastCheckEndedAtRef.current;
    if (lastEnded && Date.now() - lastEnded.getTime() < SAFETY_CHECK_COOLDOWN_MINUTES * 60_000) {
      return;
    }

    const offRouteMeters =
      here && currentRoute && currentRoute.coordinates.length > 0
        ? currentRoute.coordinates.reduce(
            (min, c) => Math.min(min, haversineMeters(here, c)),
            Infinity,
          )
        : null;

    const detectedReason = safetyCheckService.detect({
      samples: samplesRef.current,
      eta: latestRef.current.eta
        ? new Date(latestRef.current.eta.getTime() + latestRef.current.extraMinutes * 60_000)
        : null,
      offRouteMeters: offRouteMeters === Infinity ? null : offRouteMeters,
      rules: currentRules,
      now: new Date(),
    });

    if (!detectedReason) return;

    raisingRef.current = true;
    void safetyCheckService
      .raise(userId, journeyId, detectedReason, here, currentRules)
      .then((check) => {
        // The persisted deadline is authoritative — the server enforces the
        // same value, so the two can never disagree about when guardians are
        // due to be told.
        escalateAtRef.current = check.escalateAt.getTime();
        setActiveCheck(check);
        setHasEscalated(false);
        setSecondsUntilEscalation(currentRules.noReplyMinutes * 60);

        // The screen may not be foregrounded — this is the only thing that
        // reaches a traveller whose phone is in a pocket, and the escalation
        // clock is premised on them getting a chance to answer. The category
        // gives it "I'm safe" / "SOS" actions, answerable without unlocking.
        Notifications.scheduleNotificationAsync({
          identifier: SAFETY_CHECK_NOTIFICATION_ID,
          content: {
            title: 'Are you OK?',
            body: `Let us know, or we'll alert your guardians in ${currentRules.noReplyMinutes} min.`,
            categoryIdentifier: SAFETY_CHECK_NOTIFICATION_CATEGORY,
            sound: true,
          },
          trigger: null,
        }).catch(() => {});
      })
      .catch(() => {
        // Couldn't persist — don't trap the user behind a check that can never
        // be resolved. Detection retries on the next sample.
      })
      .finally(() => {
        raisingRef.current = false;
      });
  }, [userId, journeyId, activeCheck, safetyCheckService]);

  // Primary trigger: a new location sample. Appending the sample and deciding
  // on it happen together, so detection is as fresh as the data allows and
  // costs no wakeups of its own.
  useEffect(() => {
    if (!currentLocation || !journeyId) return;
    const cutoff = Date.now() - SAMPLE_RETENTION_MS;
    samplesRef.current = [
      ...samplesRef.current.filter((s) => s.at.getTime() >= cutoff),
      { coordinates: currentLocation, at: new Date() },
    ];
    runDetection();
  }, [currentLocation, journeyId, runDetection]);

  // Safety net for "late", which can become true with no new sample at all.
  useInterval(runDetection, journeyId && !activeCheck ? DETECT_SAFETY_NET_MS : null);

  // ── Actions ───────────────────────────────────────────────────────────────
  const endCheck = useCallback(() => {
    lastCheckEndedAtRef.current = new Date();
    escalateAtRef.current = null;
    setActiveCheck(null);
    setHasEscalated(false);
    setSecondsUntilEscalation(0);
    // Clear the samples so the stopped-detector needs a fresh window before it
    // can fire again — otherwise "I'm OK" on a genuine stop would re-trigger
    // the moment the cooldown lapsed, on the same stale evidence.
    samplesRef.current = [];
    Notifications.dismissNotificationAsync(SAFETY_CHECK_NOTIFICATION_ID).catch(() => {});
  }, []);

  const confirmOk = useCallback(async () => {
    if (!activeCheck || !userId || !journeyId) return;
    const check = activeCheck;
    endCheck();
    await safetyCheckService.confirm(userId, journeyId, check.id).catch(() => {});
  }, [activeCheck, userId, journeyId, safetyCheckService, endCheck]);

  const addTime = useCallback(async () => {
    if (!activeCheck || !userId || !journeyId) return;
    const check = activeCheck;
    setExtraMinutes((m) => m + SAFETY_CHECK_EXTENSION_MINUTES);
    endCheck();
    await safetyCheckService
      .extend(userId, journeyId, check.id, SAFETY_CHECK_EXTENSION_MINUTES)
      .catch(() => {});
  }, [activeCheck, userId, journeyId, safetyCheckService, endCheck]);

  const value = useMemo<SafetyCheckContextValue>(
    () => ({
      activeCheck,
      reason: activeCheck?.reason ?? null,
      secondsUntilEscalation,
      hasEscalated,
      confirmOk,
      addTime,
      adjustedEta,
    }),
    [activeCheck, secondsUntilEscalation, hasEscalated, confirmOk, addTime, adjustedEta],
  );

  return <SafetyCheckContext.Provider value={value}>{children}</SafetyCheckContext.Provider>;
}

export function useSafetyCheckContext(): SafetyCheckContextValue {
  return useContext(SafetyCheckContext);
}
