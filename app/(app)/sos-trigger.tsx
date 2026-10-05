import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { SPACING, TYPOGRAPHY } from '../../src/config/theme';
import { useSOS } from '../../src/hooks/useSOS';

/**
 * Headless action route — reached via the `wayloc:///sos-trigger` deep
 * link from the Android Quick Settings Tile / iOS Lock Screen widget, since
 * neither can call into this app's JS directly. Immediately triggers SOS
 * using the exact same path as the in-app SOS button (home.tsx's
 * handleSOSTrigger) so offline queueing, journey linking, and the Firestore
 * write shape all stay in one place rather than being re-implemented in
 * Swift/Kotlin. Placed inside the (app) group so it's auth-gated the same
 * way as every other screen — no special-casing in NavigationGuard needed.
 */
export default function SOSTriggerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { triggerSOS } = useSOS();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    triggerSOS()
      .catch(() => {})
      .finally(() => {
        router.replace('/(app)/emergency-mode');
      });
  }, [triggerSOS, router]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.critical.bg }]}>
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.critical.fg} />
        <Text style={[styles.text, { color: theme.critical.fg }]}>Sending SOS…</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
  },
  text: {
    fontSize: TYPOGRAPHY.bodyStrong.fontSize,
    fontWeight: TYPOGRAPHY.bodyStrong.fontWeight,
  },
});
