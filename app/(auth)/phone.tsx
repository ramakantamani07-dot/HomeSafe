import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { FIXED_PALETTES, FONTS, SPACING } from '../../src/config/theme';
import { deviceRegion } from '../../src/config/markets';
import { useAuth } from '../../src/hooks/useAuth';
import { SignInLockedError } from '../../src/models/SignIn';
import {
  countryForRegion,
  isValidMobile,
  nationalDigits,
  toE164,
  type Country,
} from '../../src/utils/phoneNumber';
import {
  FirebaseRecaptchaVerifier,
  type FirebaseRecaptchaVerifierHandle,
} from '../../src/components/auth/FirebaseRecaptchaVerifier';
import { STORY_ASPECT, SignInStory } from '../../src/components/auth/SignInStory';
import { SignInPhoneField } from '../../src/components/auth/SignInPhoneField';
import { BrandLockup, DevPill, SignInSheet } from '../../src/components/auth/SignInParts';
import { lockedMessage } from '../../src/components/auth/signInCopy';
import { Button } from '../../src/components/ui/Button';
import { Icon } from '../../src/components/ui/Icon';

const C = FIXED_PALETTES.signIn;
/**
 * The mock auth provider accepts any number, so a development build does
 * too; the per-country mobile rule applies wherever a real text is sent.
 */
const DEV_MIN_DIGITS = 6;

/** AN1 — "Your mobile number". */
export default function PhoneScreen() {
  const router = useRouter();
  const { sendOTP, configureRecaptchaVerifier, isDevMode } = useAuth();

  const recaptchaRef = useRef<FirebaseRecaptchaVerifierHandle | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // With the keyboard up, bring Send code above it too, not just the field
  // the OS scrolls to; the story slides up under the status bar instead.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () =>
      scrollRef.current?.scrollToEnd({ animated: true }),
    );
    return () => sub.remove();
  }, []);
  const [country, setCountry] = useState<Country>(() => countryForRegion(deviceRegion()));
  const [number, setNumber] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Not persisted — see docs/reference/IMPLEMENTATION_PLAN.md's minors item.
  // This is the enforcement (no code is sent without it); a durable
  // server-side attestation is a separate decision. Not on the AN1 board, and
  // kept anyway: see D29.
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const valid = isDevMode
    ? nationalDigits(number).length >= DEV_MIN_DIGITS
    : isValidMobile(country, number);
  const canSend = valid && (isDevMode || ageConfirmed) && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setError(null);

    if (configureRecaptchaVerifier) {
      if (!recaptchaRef.current) {
        setError('Phone verification is still getting ready. Try again in a moment.');
        return;
      }
      configureRecaptchaVerifier(recaptchaRef.current);
    }

    const phone = toE164(country, number);
    setSending(true);
    try {
      await sendOTP(phone);
      router.push({ pathname: '/(auth)/otp', params: { phone } });
    } catch (err: unknown) {
      if (err instanceof SignInLockedError) setError(lockedMessage(err.until, new Date()));
      else setError(err instanceof Error ? err.message : "We couldn't send the code. Try again.");
    } finally {
      setSending(false);
    }
  };

  const changeCountry = (next: Country) => {
    setCountry(next);
    setError(null);
  };

  const changeNumber = (digits: string) => {
    setNumber(digits);
    setError(null);
  };

  return (
    <View style={styles.root}>
      <FirebaseRecaptchaVerifier ref={recaptchaRef} enabled={!isDevMode} />
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        {/* Scrolls rather than squeezing: the story keeps its full size, and
            the keyboard inset scrolls the number field into view (iOS). */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <BrandLockup />
              {__DEV__ && isDevMode && <DevPill />}
            </View>
            <Text style={styles.headline} accessibilityRole="header">
              Walk home together,{'\n'}even when apart.
            </Text>
          </View>

          <SignInStory style={styles.story} />

          <SignInSheet style={styles.sheet}>
            <View style={styles.titles}>
              <Text style={styles.title}>Your mobile number</Text>
              <Text style={styles.subtitle}>
                {isDevMode
                  ? 'Development build — any number works; no text is sent.'
                  : 'We’ll text you a 6-digit code — no password.'}
              </Text>
            </View>

            <SignInPhoneField
              country={country}
              onCountryChange={changeCountry}
              number={number}
              onNumberChange={changeNumber}
              onSubmit={handleSend}
              disabled={sending}
            />

            {error && (
              <View style={styles.errorRow} accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Icon name="alertCircle" size={16} color={C.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {!isDevMode && (
              <TouchableOpacity
                accessibilityRole="checkbox"
                accessibilityState={{ checked: ageConfirmed }}
                style={styles.ageRow}
                onPress={() => setAgeConfirmed((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, ageConfirmed && styles.checkboxOn]}>
                  {ageConfirmed && <Icon name="check" size={13} color={C.onBrand} />}
                </View>
                <Text style={styles.ageText}>
                  I’m 18 or older. A parent or guardian holds the account for anyone younger.
                </Text>
              </TouchableOpacity>
            )}

            <Button
              variant="brand"
              label="Send code"
              onPress={handleSend}
              disabled={!canSend}
              loading={sending}
            />

            <Text style={styles.terms}>
              By continuing you agree to the{' '}
              <Text
                accessibilityRole="link"
                style={styles.termsLink}
                onPress={() => router.push('/(legal)/terms')}
              >
                Terms
              </Text>{' '}
              and{' '}
              <Text
                accessibilityRole="link"
                style={styles.termsLink}
                onPress={() => router.push('/(legal)/privacy-policy')}
              >
                Privacy Policy
              </Text>
              .
            </Text>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: SPACING.sm,
    gap: SPACING.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headline: {
    fontFamily: FONTS.headingXBold,
    fontSize: 27,
    lineHeight: 30,
    letterSpacing: -0.8,
    color: C.ink,
  },
  story: {
    aspectRatio: STORY_ASPECT,
    marginTop: SPACING.xs,
  },
  // Grows to the bottom edge, as on the board.
  sheet: {
    flexGrow: 1,
    marginTop: -SPACING.sm,
    marginBottom: 6,
    paddingBottom: SPACING.lg,
  },
  titles: {
    gap: SPACING.xs,
  },
  title: {
    fontFamily: FONTS.headingXBold,
    fontSize: 24,
    letterSpacing: -0.4,
    color: C.ink,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: C.textMuted,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  errorText: {
    flex: 1,
    fontFamily: FONTS.bodySemibold,
    fontSize: 14,
    color: C.error,
  },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm + 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    marginTop: 1,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.separator,
    backgroundColor: C.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    borderColor: C.brand,
    backgroundColor: C.brand,
  },
  ageText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 17,
    color: C.textMuted,
  },
  terms: {
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 17,
    color: C.textMuted,
    textAlign: 'center',
  },
  termsLink: {
    fontFamily: FONTS.bodySemibold,
    color: C.ink,
  },
});
