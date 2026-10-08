import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
// Must wrap the whole tree, and must be imported before any gesture is used.
// Without it, pan handlers silently never fire on Android.
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
} from '@expo-google-fonts/instrument-sans';

import { AppProviders, deviceIntegrityProvider } from '../src/context/AppProviders';
import { useAuth } from '../src/hooks/useAuth';
import { usePrivacy } from '../src/hooks/usePrivacy';
import { useCheckIn } from '../src/hooks/useCheckIn';
import { useFamily } from '../src/hooks/useFamily';
import { useSOS } from '../src/hooks/useSOS';
import { BiometricGate } from '../src/components/security/BiometricGate';
import { useSafetyCheck } from '../src/hooks/useSafetyCheck';
import {
  SAFETY_CHECK_NOTIFICATION_CATEGORY,
  SAFETY_CHECK_NOTIFICATION_ID,
} from '../src/models/SafetyCheck';

SplashScreen.preventAutoHideAsync();

// Without this, notifications delivered while the app is foregrounded don't
// necessarily show anything — this affects both the Fake Call backstop
// notification (see FakeCallService) and real SOS/missed-check-in push
// alerts arriving while the app happens to already be open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHECKIN_PROMPT_CATEGORY = 'wayloc.checkin-prompt';
const CHECKIN_PROMPT_NOTIFICATION_ID = 'wayloc.checkin-prompt-notification';
const CONFIRM_SAFE_ACTION = 'CONFIRM_SAFE';
const SOS_ACTION = 'SOS';

// Registered once at startup. Both the interval check-in and the automatic
// safety check use the same two actions, so a traveller can answer either from
// the lock screen without unlocking or opening the app — which is the only
// thing that reaches them with the phone in a pocket, and the whole reason the
// escalation window is survivable.
const PROMPT_ACTIONS = [
  { identifier: CONFIRM_SAFE_ACTION, buttonTitle: "I'm Safe" },
  { identifier: SOS_ACTION, buttonTitle: 'SOS', options: { isDestructive: true } },
];

Notifications.setNotificationCategoryAsync(CHECKIN_PROMPT_CATEGORY, PROMPT_ACTIONS).catch(() => {});

/**
 * Ask "OK?" from someone watching (S2c). Must match `ASK_OK_CATEGORY` in
 * functions/src/family/askOk.ts, or iOS shows the push without its buttons.
 * Worded "I'm OK" because that is what was asked.
 */
const ASK_OK_CATEGORY = 'wayloc.ok-request';
const ASK_OK_TYPE = 'OK_REQUESTED';
const ANSWER_OK_ACTION = 'ANSWER_OK';
Notifications.setNotificationCategoryAsync(ASK_OK_CATEGORY, [
  { identifier: ANSWER_OK_ACTION, buttonTitle: "I'm OK" },
  { identifier: SOS_ACTION, buttonTitle: 'SOS', options: { isDestructive: true } },
]).catch(() => {});
Notifications.setNotificationCategoryAsync(
  SAFETY_CHECK_NOTIFICATION_CATEGORY,
  PROMPT_ACTIONS,
).catch(() => {});

/**
 * Bridges both safety prompts to the lock screen.
 *
 * An in-app modal is invisible when the screen is locked or the app is
 * backgrounded — exactly the window both prompts exist to cover. This fires an
 * actionable notification for the interval check-in, and routes the action
 * buttons of both it and the automatic safety check (whose notification is
 * raised by SafetyCheckContext) to the right subsystem.
 *
 * Rendered inside AppProviders so the check-in, safety-check and SOS contexts
 * are all available.
 */
function SafetyPromptNotificationBridge() {
  const { phase, confirmSafe } = useCheckIn();
  const { confirmOk } = useSafetyCheck();
  const { triggerSOS } = useSOS();
  const { recordOk } = useFamily();
  const prevPhaseRef = React.useRef(phase);

  useEffect(() => {
    const enteringPrompt = phase === 'prompt' && prevPhaseRef.current !== 'prompt';
    const leavingPrompt = phase !== 'prompt' && prevPhaseRef.current === 'prompt';
    prevPhaseRef.current = phase;

    if (enteringPrompt) {
      Notifications.scheduleNotificationAsync({
        identifier: CHECKIN_PROMPT_NOTIFICATION_ID,
        content: {
          title: 'Check-in due',
          body: "Are you safe? Tap \"I'm Safe\" to confirm, or SOS if you need help.",
          categoryIdentifier: CHECKIN_PROMPT_CATEGORY,
          sound: true,
        },
        trigger: null,
      }).catch(() => {});
    } else if (leavingPrompt) {
      // Confirmed or missed via the in-app path — clear it so a stale
      // notification with dead actions doesn't linger.
      Notifications.dismissNotificationAsync(CHECKIN_PROMPT_NOTIFICATION_ID).catch(() => {});
    }
  }, [phase]);

  useEffect(() => {
    const handleResponse = (response: Notifications.NotificationResponse) => {
      const id = response.notification.request.identifier;
      const action = response.actionIdentifier;

      // Two prompts, same two actions — routed to whichever subsystem raised
      // the notification so an answer resolves the right record.
      if (id === CHECKIN_PROMPT_NOTIFICATION_ID) {
        if (action === CONFIRM_SAFE_ACTION) void confirmSafe();
        else if (action === SOS_ACTION) void triggerSOS();
      } else if (id === SAFETY_CHECK_NOTIFICATION_ID) {
        if (action === CONFIRM_SAFE_ACTION) void confirmOk();
        else if (action === SOS_ACTION) void triggerSOS();
      } else if (response.notification.request.content.data?.type === ASK_OK_TYPE) {
        // Only the button is an answer. Opening the push is not "I'm OK" —
        // the person asking would be told something nobody said.
        if (action === ANSWER_OK_ACTION) recordOk();
        else if (action === SOS_ACTION) void triggerSOS();
      }
      // A default tap (no action chosen) just opens the app, where the same
      // prompt is already on screen.
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => subscription.remove();
  }, [confirmSafe, confirmOk, triggerSOS, recordOk]);

  return null;
}

/**
 * Best-effort jailbreak/root/hook detection, once per app launch. Deliberately
 * a warning, never a block: a false positive that locked someone out of SOS
 * on a genuine emergency would be far worse than an ignorable warning on a
 * genuinely compromised device.
 */
function DeviceIntegrityCheck() {
  useEffect(() => {
    let cancelled = false;
    deviceIntegrityProvider
      .checkIntegrity()
      .then((result) => {
        if (cancelled || !result.isCompromised) return;
        Alert.alert(
          'Device Security Warning',
          "This device appears to be jailbroken or rooted, which can make wayLoc's safety features less reliable (location accuracy, background tracking, and secure storage may all be affected). You can keep using the app, but consider addressing this on a device you rely on for safety.",
        );
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return null;
}

function NavigationGuard({ fontsReady }: { fontsReady: boolean }) {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: privacyLoading } = usePrivacy();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Keep splash up until auth state, privacy preferences, AND fonts are
    // all resolved — Bricolage Grotesque/Instrument Sans need to be ready
    // before the first real screen paints, or headings flash in the system
    // font first.
    if (authLoading || privacyLoading || !fontsReady) return;
    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === '(auth)';
    // Privacy Policy / Terms must be reachable both signed-out (linked from
    // the phone-auth disclaimer) and signed-in (linked from Privacy &
    // Security) — exempt this group from the redirect in both directions.
    const inLegalGroup = segments[0] === '(legal)';

    if (!user && !inAuthGroup && !inLegalGroup) {
      router.replace('/(auth)/phone');
    } else if (user && inAuthGroup) {
      router.replace('/(app)/home');
    }
  }, [user, authLoading, privacyLoading, fontsReady, segments]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
  });
  // A real font-loading failure (bad network on first install, etc.)
  // shouldn't leave the app stuck on the splash screen forever — fall back
  // to the system font rather than block sign-in over a decorative typeface.
  const fontsReady = fontsLoaded || !!fontError;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <AppProviders>
      <StatusBar style="dark" />
      <NavigationGuard fontsReady={fontsReady} />
      <DeviceIntegrityCheck />
      <SafetyPromptNotificationBridge />
      <BiometricGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
          <Stack.Screen name="(legal)" />
        </Stack>
      </BiometricGate>
    </AppProviders>
    </GestureHandlerRootView>
  );
}
