import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { COLORS, TIMING } from '../../src/config/constants';
import { useAuth } from '../../src/hooks/useAuth';
import { LoadingOverlay } from '../../src/components/common/LoadingOverlay';
import {
  FirebaseRecaptchaVerifier,
  type FirebaseRecaptchaVerifierHandle,
} from '../../src/components/auth/FirebaseRecaptchaVerifier';

const OTP_LENGTH = 6;

export default function OTPScreen() {
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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <FirebaseRecaptchaVerifier ref={recaptchaRef} enabled={!isDevMode} />

      <View style={styles.container}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {isDevMode && (
          <View style={styles.devBanner}>
            <Text style={styles.devBannerText}>🛠 Dev mode — enter any 6 digits</Text>
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

        <TouchableOpacity
          style={[styles.button, (!isComplete || loading) && styles.buttonDisabled]}
          onPress={() => handleVerify(code)}
          disabled={!isComplete || loading}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Verify</Text>
        </TouchableOpacity>

        <View style={styles.resendRow}>
          {canResend ? (
            <TouchableOpacity onPress={handleResend} disabled={loading}>
              <Text style={styles.resendLink}>Resend code</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.resendTimer}>
              Resend in {secondsLeft}s
            </Text>
          )}
        </View>
      </View>

      <LoadingOverlay visible={loading} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
  },
  back: {
    marginBottom: 32,
  },
  backText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: 36,
  },
  phone: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  otpRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 32,
    justifyContent: 'center',
  },
  digitBox: {
    width: 48,
    height: 58,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
  },
  digitBoxFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: COLORS.textMuted,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
  },
  resendRow: {
    alignItems: 'center',
  },
  resendLink: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '600',
  },
  resendTimer: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  devBanner: {
    backgroundColor: COLORS.warning,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  devBannerText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
