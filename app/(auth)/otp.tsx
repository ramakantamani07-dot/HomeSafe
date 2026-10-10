import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { FIXED_PALETTES, FONTS, RADIUS, SPACING } from '../../src/config/theme';
import { TIMING } from '../../src/config/constants';
import { useAuth } from '../../src/hooks/useAuth';
import { useInterval } from '../../src/hooks/useInterval';
import { SignInLockedError, WrongCodeError } from '../../src/models/SignIn';
import { formatE164 } from '../../src/utils/phoneNumber';
import {
  FirebaseRecaptchaVerifier,
  type FirebaseRecaptchaVerifierHandle,
} from '../../src/components/auth/FirebaseRecaptchaVerifier';
import { SignInStory } from '../../src/components/auth/SignInStory';
import { CODE_LENGTH, CodeBoxes } from '../../src/components/auth/CodeBoxes';
import { DevPill, SignInBackButton, SignInSheet } from '../../src/components/auth/SignInParts';
import {
  formatCountdown,
  lockedMessage,
  wrongCodeMessage,
} from '../../src/components/auth/signInCopy';
import { Icon } from '../../src/components/ui/Icon';

const C = FIXED_PALETTES.signIn;
const STORY_HEIGHT = 150;
const RESEND_COOLDOWN_MS = TIMING.otpResendCooldownSeconds * 1000;

/**
 * AN2 "Enter the 6-digit code", and AN4, its wrong-code state.
 *
 * Signs in on the sixth digit — there is no Verify button. Times are kept as
 * deadlines and the clock is re-read on each tick, so a countdown that sat in
 * the background is still right when the app comes back.
 */
export default function OTPScreen() {
  const { phone = '' } = useLocalSearchParams<{ phone: string }>();
  const router = useRouter();
  const { verifyOTP, sendOTP, configureRecaptchaVerifier, isDevMode } = useAuth();

  const inputRef = useRef<TextInput>(null);
  const recaptchaRef = useRef<FirebaseRecaptchaVerifierHandle | null>(null);
  // Verification is async and ends in navigation; nothing may set state
  // after this screen has gone.
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'verifying' | 'resending' | null>(null);
  const [wrongCode, setWrongCode] = useState<string | null>(null);
  const [triesLeft, setTriesLeft] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(() => Date.now() + RESEND_COOLDOWN_MS);
  const [now, setNow] = useState(() => Date.now());

  const locked = lockedUntil !== null && now < lockedUntil;
  const resendReady = now >= resendAt;
  const ticking = !resendReady || lockedUntil !== null;
  useInterval(() => setNow(Date.now()), ticking ? 1000 : null);

  // A lock that has run out clears itself; the next code entered is fresh.
  useEffect(() => {
    if (lockedUntil !== null && now >= lockedUntil) {
      setLockedUntil(null);
      setWrongCode(null);
      setTriesLeft(null);
    }
  }, [now, lockedUntil]);

  const verify = async (digits: string) => {
    setBusy('verifying');
    setError(null);
    try {
      await verifyOTP(digits);
      if (alive.current) router.replace('/(auth)/verified');
    } catch (err: unknown) {
      if (!alive.current) return;
      setCode('');
      if (err instanceof SignInLockedError) {
        setWrongCode(digits);
        setLockedUntil(err.until.getTime());
        setNow(Date.now());
        Keyboard.dismiss();
      } else if (err instanceof WrongCodeError) {
        setWrongCode(digits);
        setTriesLeft(err.triesLeft);
      } else {
        setError(err instanceof Error ? err.message : "We couldn't check that code. Try again.");
      }
    } finally {
      if (alive.current) setBusy(null);
    }
  };

  const handleChange = (digits: string) => {
    if (busy || locked) return;
    // The first keystroke after a wrong code starts a new one.
    if (wrongCode) {
      setWrongCode(null);
      setTriesLeft(null);
    }
    setError(null);
    setCode(digits);
    if (digits.length === CODE_LENGTH) void verify(digits);
  };

  const handleResend = async () => {
    if (!resendReady || busy || locked || !phone) return;
    if (configureRecaptchaVerifier) {
      if (!recaptchaRef.current) {
        setError('Phone verification is still getting ready. Try again in a moment.');
        return;
      }
      configureRecaptchaVerifier(recaptchaRef.current);
    }
    setBusy('resending');
    setError(null);
    try {
      await sendOTP(phone);
      if (!alive.current) return;
      setCode('');
      setWrongCode(null);
      setTriesLeft(null);
      setResendAt(Date.now() + RESEND_COOLDOWN_MS);
      setNow(Date.now());
      inputRef.current?.focus();
    } catch (err: unknown) {
      if (!alive.current) return;
      if (err instanceof SignInLockedError) {
        setLockedUntil(err.until.getTime());
        setNow(Date.now());
      } else {
        setError(err instanceof Error ? err.message : "We couldn't send a new code. Try again.");
      }
    } finally {
      if (alive.current) setBusy(null);
    }
  };

  const editNumber = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/phone');
  };

  const shownPhone = formatE164(phone);
  const showWrong = !!wrongCode && code.length === 0;
  const message = locked
    ? lockedMessage(new Date(lockedUntil!), new Date(now))
    : showWrong && triesLeft !== null
      ? wrongCodeMessage(triesLeft)
      : error;

  return (
    <View style={styles.root}>
      <FirebaseRecaptchaVerifier ref={recaptchaRef} enabled={!isDevMode} />
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <SignInBackButton onPress={editNumber} />
            {__DEV__ && isDevMode && <DevPill />}
          </View>

          <SignInStory style={styles.story} />

          <SignInSheet style={styles.sheet}>
            <View style={styles.titles}>
              <Text style={styles.title} accessibilityRole="header">
                Enter the 6-digit code
              </Text>
              <Text style={styles.subtitle}>
                {/* Nothing is sent in a development build, so it does not say "Sent". */}
                {isDevMode ? 'For ' : 'Sent to '}
                <Text style={styles.phone}>{shownPhone}</Text>
                {' · '}
                <Text accessibilityRole="link" style={styles.link} onPress={editNumber}>
                  Edit
                </Text>
              </Text>
            </View>

            <CodeBoxes
              ref={inputRef}
              value={code}
              onChange={handleChange}
              wrongCode={showWrong || locked ? wrongCode : null}
              disabled={locked || busy === 'verifying'}
            />

            {message ? (
              <View style={styles.messageRow} accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Icon name="alertCircle" size={16} color={C.error} />
                <Text style={styles.messageText}>{message}</Text>
              </View>
            ) : busy === 'verifying' ? (
              <View style={styles.messageRow}>
                <ActivityIndicator size="small" color={C.brand} />
                <Text style={styles.hint}>Checking…</Text>
              </View>
            ) : (
              <Text style={styles.hint}>Signs you in automatically when all 6 digits are in.</Text>
            )}

            {!locked &&
              (showWrong ? (
                // AN4: the way forward is a fresh code.
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !resendReady || !!busy }}
                  style={[styles.pill, (!resendReady || !!busy) && styles.pillWaiting]}
                  onPress={handleResend}
                  disabled={!resendReady || !!busy}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pillText}>
                    {resendReady ? 'Send a new code' : `New code in ${formatCountdown((resendAt - now) / 1000)}`}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.resendRow}>
                  {resendReady ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      onPress={handleResend}
                      disabled={!!busy}
                      hitSlop={SPACING.sm}
                    >
                      <Text style={styles.link}>
                        {busy === 'resending' ? 'Sending…' : 'Send a new code'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.resendText}>
                      Resend code in{' '}
                      <Text style={styles.resendTime}>{formatCountdown((resendAt - now) / 1000)}</Text>
                    </Text>
                  )}
                </View>
              ))}
          </SignInSheet>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: SPACING.xs,
  },
  story: {
    height: STORY_HEIGHT,
  },
  sheet: {
    flexGrow: 1,
    marginTop: SPACING.sm,
    marginBottom: 6,
  },
  titles: {
    gap: 6,
  },
  title: {
    fontFamily: FONTS.headingXBold,
    fontSize: 26,
    letterSpacing: -0.5,
    color: C.ink,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: C.textMuted,
  },
  phone: {
    fontFamily: FONTS.bodySemibold,
    color: C.ink,
  },
  link: {
    fontFamily: FONTS.bodySemibold,
    fontSize: 14,
    color: C.brand,
  },
  hint: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: C.textMuted,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  messageText: {
    flex: 1,
    fontFamily: FONTS.bodySemibold,
    fontSize: 14,
    color: C.error,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 24,
  },
  resendText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: C.textMuted,
  },
  resendTime: {
    fontFamily: FONTS.bodySemibold,
    color: C.ink,
    fontVariant: ['tabular-nums'],
  },
  pill: {
    height: 48,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.tintFill,
  },
  pillWaiting: {
    backgroundColor: C.neutralFill,
  },
  pillText: {
    fontFamily: FONTS.bodySemibold,
    fontSize: 15,
    color: C.brand,
  },
});
