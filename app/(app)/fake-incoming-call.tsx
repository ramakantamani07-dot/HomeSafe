import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Mirrors the native incoming-call screen — see FIXED_PALETTES.fakeCall. */
const FAKE_CALL = FIXED_PALETTES.fakeCall;

import { FIXED_PALETTES } from '../../src/config/theme';
import { useRouter } from 'expo-router';

import { useFakeCall } from '../../src/hooks/useFakeCall';

export default function FakeIncomingCallScreen() {
  const router = useRouter();
  const { phase, settings, countdownSeconds, cancelCountdown, acceptCall, declineCall } =
    useFakeCall();

  // After mount, navigate back if the phase unexpectedly becomes idle
  // (e.g. user navigated here without triggering a call, or call was reset externally).
  // Skip the first render: React batches the startFakeCall() state update, so phase may
  // read 'idle' on the very first render before the update is flushed.
  const hasMounted = useRef(false);
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    if (phase === 'idle') router.back();
  }, [phase, router]);

  // Track whether the user explicitly accepted so the unmount cleanup does not
  // cancel a call that is now owned by the active-call screen.
  const didAccept = useRef(false);

  // Cancel any in-progress countdown or incoming state when this screen unmounts
  // without an explicit Accept — covers the hardware back button on Android and
  // iOS swipe-back, preventing a leaked FakeCallService timer and interval.
  useEffect(() => {
    return () => {
      if (!didAccept.current) {
        cancelCountdown();
      }
    };
  }, [cancelCountdown]);

  const handleAccept = () => {
    didAccept.current = true;
    acceptCall();
    router.push('/(app)/fake-active-call');
  };

  const handleDecline = () => {
    declineCall();
    router.back();
  };

  const handleCancelCountdown = () => {
    cancelCountdown();
    router.back();
  };

  // ── Countdown state ───────────────────────────────────────────────────────
  if (phase === 'countdown') {
    return (
      <View style={styles.fullScreen}>
        <SafeAreaView style={styles.safeInner} edges={['top', 'bottom']}>
          <View style={styles.countdownContent}>
            <Text style={styles.countdownLabel}>Incoming call in</Text>
            <Text style={styles.countdownSeconds}>{countdownSeconds}</Text>
            <Text style={styles.countdownUnit}>seconds</Text>

            <View style={styles.callerInfoCountdown}>
              <Text style={styles.callerNameCountdown}>{settings.callerName}</Text>
              {settings.callerLabel ? (
                <Text style={styles.callerLabelCountdown}>{settings.callerLabel}</Text>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.cancelCountdownBtn}
              onPress={handleCancelCountdown}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelCountdownText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Incoming call state ───────────────────────────────────────────────────
  return (
    <View style={styles.fullScreen}>
      <SafeAreaView style={styles.safeInner} edges={['top', 'bottom']}>
        {/* Top: caller info */}
        <View style={styles.callerSection}>
          <View style={styles.callerAvatar}>
            <Text style={styles.callerAvatarText}>
              {settings.callerName[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text style={styles.callerName}>{settings.callerName}</Text>
          {settings.callerLabel ? (
            <Text style={styles.callerLabel}>{settings.callerLabel}</Text>
          ) : null}
          <Text style={styles.incomingLabel}>Incoming call</Text>
        </View>

        {/* Bottom: action buttons */}
        <View style={styles.actionRow}>
          {/* Decline */}
          <View style={styles.actionItem}>
            <TouchableOpacity
              style={[styles.callBtn, styles.declineBtn]}
              onPress={handleDecline}
              activeOpacity={0.8}
            >
              <Text style={styles.callBtnIcon}>📵</Text>
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Decline</Text>
          </View>

          {/* Accept */}
          <View style={styles.actionItem}>
            <TouchableOpacity
              style={[styles.callBtn, styles.acceptBtn]}
              onPress={handleAccept}
              activeOpacity={0.8}
            >
              <Text style={styles.callBtnIcon}>📞</Text>
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Accept</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const DARK_BG = FAKE_CALL.background;
const DARK_SURFACE = FAKE_CALL.surface;

const styles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: DARK_BG },
  safeInner: { flex: 1 },

  // ── Countdown ──
  countdownContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 4,
  },
  countdownLabel: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
    marginBottom: 8,
  },
  countdownSeconds: {
    fontSize: 96,
    fontWeight: '800',
    color: FAKE_CALL.text,
    fontVariant: ['tabular-nums'],
    lineHeight: 100,
  },
  countdownUnit: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
    marginBottom: 40,
  },
  callerInfoCountdown: { alignItems: 'center', gap: 4, marginBottom: 48 },
  callerNameCountdown: { fontSize: 26, fontWeight: '700', color: FAKE_CALL.text },
  callerLabelCountdown: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
  },
  cancelCountdownBtn: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 28,
    backgroundColor: DARK_SURFACE,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  cancelCountdownText: { fontSize: 17, color: FAKE_CALL.text, fontWeight: '600' },

  // ── Incoming ──
  callerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 40,
  },
  callerAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: FAKE_CALL.control,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  callerAvatarText: { fontSize: 44, color: FAKE_CALL.text, fontWeight: '700' },
  callerName: { fontSize: 34, fontWeight: '800', color: FAKE_CALL.text, textAlign: 'center' },
  callerLabel: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
    textAlign: 'center',
  },
  incomingLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 48,
    paddingBottom: 48,
  },
  actionItem: { alignItems: 'center', gap: 10 },
  callBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtn: { backgroundColor: FAKE_CALL.decline },
  acceptBtn: { backgroundColor: FAKE_CALL.accept },
  callBtnIcon: { fontSize: 28 },
  actionLabel: { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: '600' },
});
