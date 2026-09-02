import React, { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { COLORS } from '../../src/config/constants';
import { useAuth } from '../../src/hooks/useAuth';
import { PhoneInput } from '../../src/components/common/PhoneInput';
import { LoadingOverlay } from '../../src/components/common/LoadingOverlay';
import {
  FirebaseRecaptchaVerifier,
  type FirebaseRecaptchaVerifierHandle,
} from '../../src/components/auth/FirebaseRecaptchaVerifier';

export default function PhoneScreen() {
  const router = useRouter();
  const { sendOTP, configureRecaptchaVerifier, isDevMode } = useAuth();

  const recaptchaRef = useRef<FirebaseRecaptchaVerifierHandle | null>(null);
  const [phone, setPhone] = useState(''); // E.164 e.g. "+919876543210"
  const [loading, setLoading] = useState(false);

  const isValidPhone = phone.replace(/\D/g, '').length >= 10;

  const handleSendOTP = async () => {
    if (!isValidPhone) return;

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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <FirebaseRecaptchaVerifier ref={recaptchaRef} enabled={!isDevMode} />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {isDevMode && (
          <View style={styles.devBanner}>
            <Text style={styles.devBannerText}>
              🛠 Dev mode — any number + any 6-digit code works
            </Text>
          </View>
        )}

        <View style={styles.header}>
          <Text style={styles.logo}>🛡️</Text>
          <Text style={styles.appName}>HomeSafe</Text>
          <Text style={styles.tagline}>Your personal safety companion</Text>
        </View>

        <View style={styles.form}>
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

          <TouchableOpacity
            style={[styles.button, (!isValidPhone || loading) && styles.buttonDisabled]}
            onPress={handleSendOTP}
            disabled={!isValidPhone || loading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {isDevMode ? 'Continue' : 'Send OTP'}
            </Text>
          </TouchableOpacity>

          {!isDevMode && (
            <Text style={styles.disclaimer}>
              By continuing you agree to our Terms of Service and Privacy Policy.
              Your number is only used for sign-in — we never share it.
            </Text>
          )}
        </View>
      </ScrollView>

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
    flexGrow: 1,
    padding: 24,
  },
  devBanner: {
    backgroundColor: COLORS.warning,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    marginTop: 8,
  },
  devBannerText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 40,
  },
  logo: {
    fontSize: 56,
    marginBottom: 12,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  form: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: 28,
  },
  inputWrapper: {
    marginBottom: 20,
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
  disclaimer: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
