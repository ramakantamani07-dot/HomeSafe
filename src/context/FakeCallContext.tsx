import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';

import type { FakeCallPhase, FakeCallSettings } from '../models/FakeCall';
import { defaultFakeCallSettings } from '../models/FakeCall';
import { FAKE_CALL_NOTIFICATION_ID, type FakeCallService } from '../services/FakeCallService';

// A tapped notification response older than this is treated as stale rather
// than a live trigger — getLastNotificationResponseAsync() can otherwise
// resurface a days-old tap on an unrelated later cold start. Generous buffer
// over the 60s max fake-call delay to allow for real tap-reaction time.
const STALE_RESPONSE_THRESHOLD_MS = 120_000;

interface SettingsStore {
  load(): Promise<FakeCallSettings>;
  save(settings: FakeCallSettings): Promise<void>;
}

export interface FakeCallContextValue {
  phase: FakeCallPhase;
  settings: FakeCallSettings;
  /** Seconds remaining in the pre-call countdown. Zero when not counting down. */
  countdownSeconds: number;
  /** Seconds elapsed since the call was accepted. Zero when not in active call. */
  callDurationSeconds: number;
  /**
   * Start the fake-call sequence using the current settings.
   * No-op if a call is already in progress (prevents duplicate timers).
   */
  startFakeCall(): void;
  /** Cancel the pre-call countdown and return to idle. */
  cancelCountdown(): void;
  /** Transition from incoming to active call. */
  acceptCall(): void;
  /** Dismiss the incoming call and return to idle. */
  declineCall(): void;
  /** End the active call and return to idle. */
  endCall(): void;
  /** Persist updated settings. */
  updateSettings(next: FakeCallSettings): Promise<void>;
}

const FakeCallContext = createContext<FakeCallContextValue>({
  phase: 'idle',
  settings: defaultFakeCallSettings(),
  countdownSeconds: 0,
  callDurationSeconds: 0,
  startFakeCall: () => {},
  cancelCountdown: () => {},
  acceptCall: () => {},
  declineCall: () => {},
  endCall: () => {},
  updateSettings: async () => {},
});

export function FakeCallStateProvider({
  fakeCallService,
  settingsStore,
  children,
}: {
  fakeCallService: FakeCallService;
  settingsStore: SettingsStore;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const [phase, setPhase] = useState<FakeCallPhase>('idle');
  const [settings, setSettings] = useState<FakeCallSettings>(defaultFakeCallSettings());
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);

  // Always-current ref so callbacks see the latest phase without being re-created.
  const phaseRef = useRef<FakeCallPhase>('idle');
  phaseRef.current = phase;

  // Wall-clock end time of the countdown, used to compute remaining seconds accurately.
  const countdownEndAtRef = useRef<number | null>(null);

  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load persisted settings once on mount.
  useEffect(() => {
    void settingsStore.load().then(setSettings);
  }, [settingsStore]);

  const clearCountdownInterval = useCallback(() => {
    if (countdownIntervalRef.current !== null) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const clearDurationInterval = useCallback(() => {
    if (durationIntervalRef.current !== null) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const resetToIdle = useCallback(() => {
    fakeCallService.cancelPending();
    clearCountdownInterval();
    clearDurationInterval();
    countdownEndAtRef.current = null;
    phaseRef.current = 'idle';
    setPhase('idle');
    setCountdownSeconds(0);
    setCallDurationSeconds(0);
  }, [fakeCallService, clearCountdownInterval, clearDurationInterval]);

  const startFakeCall = useCallback(() => {
    // Prevent duplicate timers — only start when idle.
    if (phaseRef.current !== 'idle') return;

    const delay = settings.delaySeconds;

    const onIncoming = () => {
      countdownEndAtRef.current = null;
      clearCountdownInterval();
      setCountdownSeconds(0);
      phaseRef.current = 'incoming';
      setPhase('incoming');
    };

    if (delay > 0) {
      countdownEndAtRef.current = Date.now() + delay * 1_000;
      phaseRef.current = 'countdown';
      setPhase('countdown');
      setCountdownSeconds(delay);

      // Tick twice per second so the display stays accurate without drift.
      countdownIntervalRef.current = setInterval(() => {
        const endAt = countdownEndAtRef.current;
        if (endAt === null) {
          clearCountdownInterval();
          return;
        }
        const remaining = Math.ceil(Math.max(0, (endAt - Date.now()) / 1_000));
        setCountdownSeconds(remaining);
      }, 500);
    }

    fakeCallService.schedule(delay, onIncoming, settings.callerName);
  }, [settings.delaySeconds, settings.callerName, fakeCallService, clearCountdownInterval]);

  const cancelCountdown = useCallback(() => {
    resetToIdle();
  }, [resetToIdle]);

  const acceptCall = useCallback(() => {
    if (phaseRef.current !== 'incoming') return;
    phaseRef.current = 'active';
    setPhase('active');
    setCallDurationSeconds(0);
    durationIntervalRef.current = setInterval(() => {
      setCallDurationSeconds((prev) => prev + 1);
    }, 1_000);
  }, []);

  const declineCall = useCallback(() => {
    resetToIdle();
  }, [resetToIdle]);

  const endCall = useCallback(() => {
    resetToIdle();
  }, [resetToIdle]);

  const updateSettings = useCallback(
    async (next: FakeCallSettings) => {
      setSettings(next);
      await settingsStore.save(next);
    },
    [settingsStore],
  );

  // Clear all timers when the provider unmounts (e.g. sign-out).
  useEffect(() => {
    return () => {
      fakeCallService.cancelPending();
      clearCountdownInterval();
      clearDurationInterval();
    };
  }, [fakeCallService, clearCountdownInterval, clearDurationInterval]);

  // Backstop path: if the JS countdown timer never got to run — the screen
  // locked, or the app was backgrounded during the up-to-60s wait — the
  // scheduled notification (see FakeCallService) still fires and can be
  // tapped to jump straight into the ringing screen. Covers both the app
  // already running (response listener) and the app cold-started by the tap
  // (checked once via getLastNotificationResponseAsync).
  useEffect(() => {
    const isFakeCallResponse = (response: Notifications.NotificationResponse | null): boolean =>
      response?.notification.request.identifier === FAKE_CALL_NOTIFICATION_ID;

    const isFresh = (response: Notifications.NotificationResponse): boolean => {
      const deliveredAtMs = response.notification.date * 1_000;
      return Date.now() - deliveredAtMs < STALE_RESPONSE_THRESHOLD_MS;
    };

    const handleResponse = (response: Notifications.NotificationResponse) => {
      if (!isFakeCallResponse(response) || !isFresh(response)) return;
      if (phaseRef.current === 'incoming' || phaseRef.current === 'active') return;

      countdownEndAtRef.current = null;
      clearCountdownInterval();
      setCountdownSeconds(0);
      phaseRef.current = 'incoming';
      setPhase('incoming');
      router.push('/(app)/fake-incoming-call');
    };

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handleResponse(response);
      })
      .catch(() => {});

    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => subscription.remove();
  }, [router, clearCountdownInterval]);

  const value = useMemo<FakeCallContextValue>(
    () => ({
      phase,
      settings,
      countdownSeconds,
      callDurationSeconds,
      startFakeCall,
      cancelCountdown,
      acceptCall,
      declineCall,
      endCall,
      updateSettings,
    }),
    [
      phase,
      settings,
      countdownSeconds,
      callDurationSeconds,
      startFakeCall,
      cancelCountdown,
      acceptCall,
      declineCall,
      endCall,
      updateSettings,
    ],
  );

  return (
    <FakeCallContext.Provider value={value}>{children}</FakeCallContext.Provider>
  );
}

export function useFakeCallContext(): FakeCallContextValue {
  return useContext(FakeCallContext);
}
