import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { COLORS } from '../config/constants';

interface SOSButtonProps {
  onTrigger(): Promise<void> | void;
  disabled?: boolean;
  /** 'full' shows a large card with label; 'compact' shows a smaller inline button. */
  variant?: 'full' | 'compact';
}

const COUNTDOWN_START = 3;

export function SOSButton({ onTrigger, disabled, variant = 'full' }: SOSButtonProps) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [triggering, setTriggering] = useState(false);
  // Keep onTrigger ref so the effect never captures a stale callback.
  const onTriggerRef = useRef(onTrigger);
  onTriggerRef.current = onTrigger;

  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      setCountdown(null);
      setTriggering(true);
      Promise.resolve(onTriggerRef.current()).finally(() => setTriggering(false));
      return;
    }

    const id = setTimeout(
      () => setCountdown((c) => (c !== null ? c - 1 : null)),
      1_000,
    );
    return () => clearTimeout(id);
  }, [countdown]);

  const handlePress = () => {
    if (triggering) return;
    if (countdown !== null) {
      setCountdown(null); // cancel
      return;
    }
    setCountdown(COUNTDOWN_START);
  };

  const isActive = countdown !== null || triggering;

  if (variant === 'compact') {
    return (
      <TouchableOpacity
        style={[styles.compactBtn, isActive && styles.compactBtnActive]}
        onPress={handlePress}
        disabled={disabled && !isActive}
        activeOpacity={0.8}
      >
        {triggering ? (
          <ActivityIndicator color={COLORS.white} size="small" />
        ) : countdown !== null ? (
          <Text style={styles.compactCountdown}>{countdown}</Text>
        ) : (
          <Text style={styles.compactLabel}>SOS</Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.fullWrapper}>
      <TouchableOpacity
        style={[styles.fullBtn, isActive && styles.fullBtnActive]}
        onPress={handlePress}
        disabled={disabled && !isActive}
        activeOpacity={0.85}
      >
        {triggering ? (
          <ActivityIndicator color={COLORS.white} size="large" />
        ) : countdown !== null ? (
          <>
            <Text style={styles.fullCountdownNum}>{countdown}</Text>
            <Text style={styles.fullCountdownHint}>Tap to cancel</Text>
          </>
        ) : (
          <>
            <Text style={styles.fullLabel}>SOS</Text>
            <Text style={styles.fullSubLabel}>Tap to send alert</Text>
          </>
        )}
      </TouchableOpacity>
      {countdown !== null && (
        <Text style={styles.cancelHint}>Tap the button to cancel</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Compact variant
  compactBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  compactBtnActive: {
    backgroundColor: COLORS.dangerDark,
  },
  compactLabel: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  compactCountdown: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '800',
  },
  // Full variant
  fullWrapper: {
    alignItems: 'center',
    gap: 10,
  },
  fullBtn: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 4,
    borderColor: COLORS.dangerDark,
  },
  fullBtnActive: {
    backgroundColor: COLORS.dangerDark,
    shadowOpacity: 0.6,
  },
  fullLabel: {
    color: COLORS.white,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
  },
  fullSubLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  fullCountdownNum: {
    color: COLORS.white,
    fontSize: 52,
    fontWeight: '900',
  },
  fullCountdownHint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
  },
  cancelHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
