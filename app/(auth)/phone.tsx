import React, { useRef, useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { ELEVATION, RADIUS, SPACING, TYPOGRAPHY } from '../../src/config/theme';
import { useAuth } from '../../src/hooks/useAuth';
import { PhoneInput } from '../../src/components/common/PhoneInput';
import { LoadingOverlay } from '../../src/components/common/LoadingOverlay';
import {
  FirebaseRecaptchaVerifier,
  type FirebaseRecaptchaVerifierHandle,
} from '../../src/components/auth/FirebaseRecaptchaVerifier';
import { Icon } from '../../src/components/ui/Icon';
import { Button } from '../../src/components/ui/Button';
import type { ThemeColors } from '../../src/config/theme';

// Clean full scene, no baked-in UI (unlike bg1/bg2, which have a blurred
// panel and controls rendered into the pixels — see the comment history on
// this file). Used full-bleed behind the whole sign-in flow. Only a day
// version exists so far; used in both themes for now with the scrim/card
// colors adapting instead — swap in a clean night equivalent here if one
// gets added later.
const bgScene = require('../../assets/bg3.jpg');
// The brand mark itself, transparent, so it sits on the photo rather than in
// a plate on top of it. Same source the app icon is generated from.
const brandLogo = require('../../assets/logo-signin.png');

/** Big enough to read the wordmark inside the artwork, small enough to leave
 *  the sign-in card the focus of the screen. */
const BRAND_LOGO_SIZE = 132;

export default function PhoneScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();
  const { sendOTP, configureRecaptchaVerifier, isDevMode } = useAuth();

  const recaptchaRef = useRef<FirebaseRecaptchaVerifierHandle | null>(null);
  const [phone, setPhone] = useState(''); // E.164 e.g. "+919876543210"
  const [loading, setLoading] = useState(false);
  // Not persisted anywhere — see docs/reference/IMPLEMENTATION_PLAN.md's minors item. This is
  // the actual enforcement mechanism (can't proceed without checking it);
  // whether to also store a durable attestation record server-side for
  // compliance evidence is a separate decision, deliberately not built here.
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const isValidPhone = phone.replace(/\D/g, '').length >= 10;
  const canSubmit = isValidPhone && (isDevMode || ageConfirmed);

  const handleSendOTP = async () => {
    if (!canSubmit) return;

    // Wire reCAPTCHA verifier into Firebase provider right before the call.
    if (configureRecaptchaVerifier && !recaptchaRef.current) {
      Alert.alert('Please wait', 'Phone verification is still getting ready.');
      return;
    }

    if (configureRecaptchaVerifier && recaptchaRef.current) {
      configureRecaptchaVerifier(recaptchaRef.current);
    }

    setLoading(true);
    try {
      await sendOTP(phone);
      router.push({ pathname: '/(auth)/otp', params: { phone } });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send OTP.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground source={bgScene} style={styles.flex} resizeMode="cover">
      <View style={styles.scrimBottom} />
      <FirebaseRecaptchaVerifier ref={recaptchaRef} enabled={!isDevMode} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={styles.flex} edges={['top']}>
          <View style={styles.brandRow}>
            <Image
              source={brandLogo}
              style={styles.brandLogo}
              resizeMode="contain"
              accessible
              accessibilityRole="image"
              accessibilityLabel="wayLoc"
            />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.card}>
              {isDevMode && (
                <View style={styles.devBanner}>
                  <Text style={styles.devBannerText}>
                    Dev mode — any number + any 6-digit code works
                  </Text>
                </View>
              )}

              <Text style={styles.title}>Enter your phone number</Text>
              <Text style={styles.subtitle}>
                {isDevMode
                  ? 'Dev mode: enter any number to continue.'
                  : "We'll send a one-time code to verify your number."}
              </Text>

              <View style={styles.inputWrapper}>
                <PhoneInput
                  onPhoneChange={setPhone}
                  onSubmit={handleSendOTP}
                  disabled={loading}
                />
              </View>

              {!isDevMode && (
                <TouchableOpacity
                  style={styles.ageRow}
                  onPress={() => setAgeConfirmed((v) => !v)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, ageConfirmed && styles.checkboxChecked]}>
                    {ageConfirmed && <Icon name="check" size={13} color={theme.textOnColor} />}
                  </View>
                  <Text style={styles.ageRowText}>
                    I confirm I am 18 or older. wayLoc accounts are for adults — a parent or
                    guardian should hold the account and manage sharing for a family member who is
                    a minor.
                  </Text>
                </TouchableOpacity>
              )}

              <Button
                label={isDevMode ? 'Continue' : 'Send OTP'}
                onPress={handleSendOTP}
                disabled={!canSubmit || loading}
                style={styles.button}
              />

              {!isDevMode && (
                <Text style={styles.disclaimer}>
                  By continuing you agree to our{' '}
                  <Text
                    style={styles.disclaimerLink}
                    onPress={() => router.push('/(legal)/terms')}
                  >
                    Terms of Service
                  </Text>{' '}
                  and{' '}
                  <Text
                    style={styles.disclaimerLink}
                    onPress={() => router.push('/(legal)/privacy-policy')}
                  >
                    Privacy Policy
                  </Text>
                  . Your number is only used for sign-in — we never share it.
                </Text>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>

      <LoadingOverlay visible={loading} />
    </ImageBackground>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    flex: {
      flex: 1,
    },
    scrimBottom: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: '62%',
      backgroundColor: theme.isDark ? 'rgba(6,10,25,0.72)' : 'rgba(0,0,0,0.28)',
    },
    brandRow: {
      alignItems: 'center',
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.lg,
    },
    brandLogo: {
      width: BRAND_LOGO_SIZE,
      height: BRAND_LOGO_SIZE,
      // The photo behind this is a bright sunset and the mark is warm orange —
      // close enough in value to lose its edges without separation. ELEVATION
      // .float exists for exactly this (a control over arbitrary imagery), so
      // it is reused rather than hand-rolled.
      ...ELEVATION.float,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'flex-end',
    },
    card: {
      backgroundColor: theme.isDark ? 'rgba(17,27,58,0.9)' : 'rgba(255,255,255,0.92)',
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      borderWidth: theme.isDark ? 1 : 0,
      borderColor: theme.isDark ? theme.border : 'transparent',
      borderBottomWidth: 0,
      padding: SPACING.xl,
      paddingTop: SPACING.xxl,
    },
    devBanner: {
      backgroundColor: theme.warning.fg,
      borderRadius: RADIUS.sm + 2,
      paddingVertical: SPACING.sm + 2,
      paddingHorizontal: SPACING.md + 2,
      marginBottom: SPACING.lg,
    },
    devBannerText: {
      color: theme.textOnColor,
      fontSize: TYPOGRAPHY.callout.fontSize,
      fontWeight: '600',
      textAlign: 'center',
    },
    title: {
      fontSize: TYPOGRAPHY.heading.fontSize + 2,
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: SPACING.sm,
    },
    subtitle: {
      fontSize: TYPOGRAPHY.body.fontSize,
      color: theme.textSecondary,
      lineHeight: 22,
      marginBottom: SPACING.xxl - 4,
    },
    inputWrapper: {
      marginBottom: SPACING.lg,
    },
    ageRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm + 2,
      marginBottom: SPACING.lg,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
      flexShrink: 0,
    },
    checkboxChecked: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    ageRowText: {
      flex: 1,
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 17,
    },
    button: {
      marginBottom: SPACING.lg,
    },
    disclaimer: {
      fontSize: 12,
      color: theme.textTertiary,
      textAlign: 'center',
      lineHeight: 18,
    },
    disclaimerLink: {
      color: theme.accent,
      fontWeight: '600',
      textDecorationLine: 'underline',
    },
  });
}
