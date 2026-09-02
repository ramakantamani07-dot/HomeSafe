import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { AppProviders } from '../src/context/AppProviders';
import { useAuth } from '../src/hooks/useAuth';
import { usePrivacy } from '../src/hooks/usePrivacy';
import { BiometricGate } from '../src/components/security/BiometricGate';

SplashScreen.preventAutoHideAsync();

function NavigationGuard() {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: privacyLoading } = usePrivacy();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Keep splash up until both auth state and privacy preferences are resolved.
    if (authLoading || privacyLoading) return;
    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/phone');
    } else if (user && inAuthGroup) {
      router.replace('/(app)/home');
    }
  }, [user, authLoading, privacyLoading, segments]);

  return null;
}

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <NavigationGuard />
      <BiometricGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </BiometricGate>
    </AppProviders>
  );
}
