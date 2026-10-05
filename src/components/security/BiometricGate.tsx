import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { SPACING, TYPOGRAPHY } from '../../config/theme';
import { useAuth } from '../../hooks/useAuth';
import { usePrivacy } from '../../hooks/usePrivacy';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import type { ThemeColors } from '../../config/theme';

/**
 * Module-level flag: true once the user has authenticated this process lifetime.
 * Resets only on app kill — background/foreground does NOT re-lock (Phase 1-D scope).
 */
let sessionUnlocked = false;

export function BiometricGate({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const styles = getStyles(theme);
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
      <View style={styles.logoCircle}>
        <Icon name="shield" size={40} color={theme.textOnColor} />
      </View>
      <Text style={styles.appName}>wayLoc</Text>
      <Text style={styles.subtitle}>Unlock to continue</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <Button
        label="Unlock with Biometrics"
        icon="lock"
        onPress={handleUnlock}
        loading={authenticating}
        fullWidth={false}
        style={styles.unlockButton}
      />
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.xxl - 8,
      gap: SPACING.md,
    },
    logoCircle: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.xs,
    },
    appName: {
      fontSize: TYPOGRAPHY.title.fontSize + 4,
      fontWeight: '800',
      color: theme.textPrimary,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: TYPOGRAPHY.body.fontSize,
      color: theme.textSecondary,
      marginBottom: SPACING.lg,
    },
    error: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      color: theme.critical.fg,
      textAlign: 'center',
      lineHeight: 20,
    },
    unlockButton: {
      marginTop: SPACING.sm,
      paddingHorizontal: SPACING.xxl,
      minWidth: 260,
    },
  });
}
