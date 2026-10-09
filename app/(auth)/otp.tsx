import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../src/config/theme';
import { TIMING } from '../../src/config/constants';
import { useAuth } from '../../src/hooks/useAuth';
import { LoadingOverlay } from '../../src/components/common/LoadingOverlay';
import {
  FirebaseRecaptchaVerifier,
  type FirebaseRecaptchaVerifierHandle,
} from '../../src/components/auth/FirebaseRecaptchaVerifier';
import { Button } from '../../src/components/ui/Button';
import type { ThemeColors } from '../../src/config/theme';

const OTP_LENGTH = 6;

// Same clean scene as phone.tsx — kept as the backdrop for the whole
// sign-in flow, not just the first screen, so it reads as one continuous
// moment rather than a photo on step one and a plain screen on step two.
const bgScene = require('../../assets/bg3.jpg');

export default function OTPScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const router = useRouter();
  const { verifyOTP, sendOTP, configureRecaptchaVerifier, isDevMode } = useAuth();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(TIMING.otpResendCooldownSeconds);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null));
  const recaptchaRef = useRef<FirebaseRecaptchaVerifierHandle | null>(null);

  // Countdown timer for resend
  useEffect(() => {
    if (secondsLeft <= 0) {
      setCanResend(true);
      return;
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const handleDigitChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits filled
    if (digit && next.every((d) => d !== '')) {
      handleVerify(next.join(''));
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code: string) => {
    setLoading(true);
    try {
      await verifyOTP(code);
      router.replace('/(app)/home');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid code. Please try again.';
      Alert.alert('Verification failed', message);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || !phone) return;

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
      setDigits(Array(OTP_LENGTH).fill(''));
      setSecondsLeft(TIMING.otpResendCooldownSeconds);
      setCanResend(false);
      inputRefs.current[0]?.focus();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resend OTP.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const code = digits.join('');
  const isComplete = code.length === OTP_LENGTH;

  return (
    <ImageBackground source={bgScene} style={styles.flex} resizeMode="cover">
      <View style={styles.scrimBottom} />
      <FirebaseRecaptchaVerifier ref={recaptchaRef} enabled={!isDevMode} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={styles.flex} edges={['top']}>
          <TouchableOpacity accessibilityRole="button" style={styles.back} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.spacer} />

          <View style={styles.card}>
            {isDevMode && (
              <View style={styles.devBanner}>
                <Text style={styles.devBannerText}>Dev mode — enter any 6 digits</Text>
              </View>
            )}

            <Text style={styles.title}>Enter the code</Text>
            <Text style={styles.subtitle}>
              {isDevMode
                ? 'Enter any 6-digit code to sign in.'
                : <>We sent a 6-digit code to{'\n'}<Text style={styles.phone}>{phone}</Text></>}
            </Text>

            <View style={styles.otpRow}>
              {digits.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(ref) => { inputRefs.current[i] = ref; }}
                  style={[styles.digitBox, digit ? styles.digitBoxFilled : null]}
                  value={digit}
                  onChangeText={(t) => handleDigitChange(t, i)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  caretHidden
                />
              ))}
            </View>

            <Button
              label="Verify"
              onPress={() => handleVerify(code)}
              disabled={!isComplete || loading}
              style={styles.button}
            />

            <View style={styles.resendRow}>
              {canResend ? (
                <TouchableOpacity accessibilityRole="button" onPress={handleResend} disabled={loading}>
                  <Text style={styles.resendLink}>Resend code</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.resendTimer}>
                  Resend in {secondsLeft}s
                </Text>
              )}
            </View>
          </View>
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
      height: '68%',
      backgroundColor: theme.isDark ? 'rgba(6,10,25,0.72)' : 'rgba(0,0,0,0.28)',
    },
    back: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.lg,
    },
    backText: {
      fontSize: TYPOGRAPHY.body.fontSize,
      color: theme.textOnColor,
      fontWeight: '600',
      textShadowColor: 'rgba(0,0,0,0.4)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    spacer: {
      flex: 1,
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
    title: {
      fontSize: TYPOGRAPHY.title.fontSize,
      fontWeight: '800',
      color: theme.textPrimary,
      marginBottom: SPACING.sm + 2,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: TYPOGRAPHY.body.fontSize,
      color: theme.textSecondary,
      lineHeight: 22,
      marginBottom: SPACING.xxl - 4,
    },
    phone: {
      color: theme.textPrimary,
      fontWeight: '600',
    },
    otpRow: {
      flexDirection: 'row',
      gap: SPACING.sm + 2,
      marginBottom: SPACING.xxl - 4,
      justifyContent: 'center',
    },
    digitBox: {
      width: 48,
      height: 58,
      borderWidth: 1.5,
      borderColor: theme.border,
      borderRadius: RADIUS.md,
      textAlign: 'center',
      fontSize: 24,
      fontWeight: '700',
      color: theme.textPrimary,
      backgroundColor: theme.surface,
    },
    digitBoxFilled: {
      borderColor: theme.accent,
      backgroundColor: theme.accentMuted,
    },
    button: {
      marginBottom: SPACING.lg,
    },
    resendRow: {
      alignItems: 'center',
    },
    resendLink: {
      fontSize: TYPOGRAPHY.body.fontSize,
      color: theme.accent,
      fontWeight: '600',
    },
    resendTimer: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      color: theme.textSecondary,
    },
    devBanner: {
      backgroundColor: theme.warning.fg,
      borderRadius: RADIUS.sm + 2,
      paddingVertical: SPACING.sm + 2,
      paddingHorizontal: SPACING.md + 2,
      marginBottom: SPACING.xl,
    },
    devBannerText: {
      color: theme.textOnColor,
      fontSize: TYPOGRAPHY.callout.fontSize,
      fontWeight: '600',
      textAlign: 'center',
    },
  });
}
