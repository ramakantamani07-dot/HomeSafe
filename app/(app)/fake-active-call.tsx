import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Mirrors the native incoming-call screen — see FIXED_PALETTES.fakeCall. */
const FAKE_CALL = FIXED_PALETTES.fakeCall;

import { FIXED_PALETTES } from '../../src/config/theme';

import { useFakeCall } from '../../src/hooks/useFakeCall';
import { useGoBack } from '../../src/hooks/useGoBack';

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(Math.max(totalSeconds, 0) / 60);
  const s = Math.max(totalSeconds, 0) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function FakeActiveCallScreen() {
  const goBack = useGoBack();
  const { phase, settings, callDurationSeconds, endCall } = useFakeCall();

  // Navigate back if phase becomes non-active after mount.
  // Skip the first render to tolerate any React batch-update timing.
  const hasMounted = useRef(false);
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    if (phase !== 'active') goBack();
  }, [phase, goBack]);

  // Guard so we don't call endCall() twice when the user presses the End Call
  // button (explicit) AND the unmount cleanup also fires.
  const hasEndedRef = useRef(false);

  // End the call and clear the duration interval when the screen unmounts without
  // an explicit End Call press — covers hardware back and iOS swipe-back.
  useEffect(() => {
    return () => {
      if (!hasEndedRef.current) {
        endCall();
      }
    };
  }, [endCall]);

  const handleEnd = () => {
    hasEndedRef.current = true;
    endCall();
    goBack();
  };

  return (
    <View style={styles.fullScreen}>
      <SafeAreaView style={styles.safeInner} edges={['top', 'bottom']}>
        {/* Caller info */}
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
          <Text style={styles.connectedLabel}>Connected</Text>
          <Text style={styles.duration}>{formatMMSS(callDurationSeconds)}</Text>
        </View>

        {/* Call controls */}
        <View style={styles.controlsSection}>
          {/* Mute and Speaker placeholders */}
          <View style={styles.controlRow}>
            <View style={styles.controlItem}>
              <View style={[styles.controlBtn, styles.controlBtnDisabled]}>
                <Text style={styles.controlIcon}>🔇</Text>
              </View>
              <Text style={styles.controlLabel}>Mute</Text>
            </View>
            <View style={styles.controlItem}>
              <View style={[styles.controlBtn, styles.controlBtnDisabled]}>
                <Text style={styles.controlIcon}>🔊</Text>
              </View>
              <Text style={styles.controlLabel}>Speaker</Text>
            </View>
          </View>

          {/* End call */}
          <TouchableOpacity accessibilityRole="button"
            style={styles.endCallBtn}
            onPress={handleEnd}
            activeOpacity={0.8}
          >
            <Text style={styles.endCallIcon}>📵</Text>
          </TouchableOpacity>
          <Text style={styles.endCallLabel}>End Call</Text>
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

  callerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
  connectedLabel: {
    fontSize: 14,
    color: FAKE_CALL.accept,
    fontWeight: '600',
    marginTop: 8,
  },
  duration: {
    fontSize: 22,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },

  controlsSection: {
    alignItems: 'center',
    paddingBottom: 48,
    gap: 24,
  },
  controlRow: {
    flexDirection: 'row',
    gap: 48,
    justifyContent: 'center',
  },
  controlItem: { alignItems: 'center', gap: 8 },
  controlBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: DARK_SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  controlBtnDisabled: { opacity: 0.4 },
  controlIcon: { fontSize: 24 },
  controlLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  endCallBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: FAKE_CALL.decline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endCallIcon: { fontSize: 28 },
  endCallLabel: { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: '600' },
});
