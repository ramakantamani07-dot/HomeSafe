import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { COLORS } from '../../config/constants';
import { useAuth } from '../../hooks/useAuth';
import { usePrivacy } from '../../hooks/usePrivacy';

/**
 * Module-level flag: true once the user has authenticated this process lifetime.
 * Resets only on app kill — background/foreground does NOT re-lock (Phase 1-D scope).
 */
let sessionUnlocked = false;

export function BiometricGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { biometricLockEnabled, biometricAvailable, isLoading, unlockWithBiometric } = usePrivacy();
  const [unlocked, setUnlocked] = useState(sessionUnlocked);
  const [error, setError] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState(false);

  const shouldLock = Boolean(
    user &&
    !isLoading &&
    biometricLockEnabled &&
    biometricAvailable &&
    !unlocked
  );

  const handleUnlock = async () => {
    setAuthenticating(true);
    setError(null);
    try {
      const success = await unlockWithBiometric();
      if (success) {
        sessionUnlocked = true;
        setUnlocked(true);
      } else {
        setError('Authentication was cancelled. Tap to try again.');
      }
    } catch {
      setError('Authentication failed. Tap to try again.');
    } finally {
      setAuthenticating(false);
    }
  };

  if (!shouldLock) {
    return <>{children}</>;
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.logo}>🛡️</Text>
      <Text style={styles.appName}>HomeSafe</Text>
      <Text style={styles.subtitle}>Unlock to continue</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.unlockButton, authenticating && styles.unlockButtonBusy]}
        onPress={handleUnlock}
        disabled={authenticating}
        activeOpacity={0.85}
      >
        {authenticating ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <Text style={styles.unlockButtonText}>🔐  Unlock with Biometrics</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  logo: {
    fontSize: 64,
    marginBottom: 4,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  error: {
    fontSize: 14,
    color: COLORS.danger,
    textAlign: 'center',
    lineHeight: 20,
  },
  unlockButton: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minWidth: 260,
    alignItems: 'center',
  },
  unlockButtonBusy: {
    backgroundColor: COLORS.textMuted,
  },
  unlockButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
