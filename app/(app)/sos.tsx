import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { FIXED_PALETTES, FONTS, RADIUS, SPACING } from '../../src/config/theme';
import { useSOS } from '../../src/hooks/useSOS';
import { useGoBack } from '../../src/hooks/useGoBack';
import { localEmergencyNumber } from '../../src/config/markets';
import { SOS_CANCEL_WINDOW_SECONDS, type SOSTier } from '../../src/models/SOS';
import { useFamily } from '../../src/hooks/useFamily';
import { CountdownRing } from '../../src/components/ui/CountdownRing';
import { joinGuardianNames } from '../../src/utils/guardians';
import { useAndroidBack } from '../../src/hooks/useAndroidBack';

/**
 * Screen 09 — Emergency.
 *
 * Always dark and always red, in both themes: this screen must look nothing
 * like the rest of the app, so it is unmistakable at a glance and cannot be
 * confused with a normal confirmation. The palette lives in the theme module
 * (FIXED_PALETTES.sos) rather than inline, so changing the app's colours stays
 * a one-file job even for the parts that opt out of theming.
 */
const SOS = FIXED_PALETTES.sos;

/** Spec §3: press-and-hold, 3 s, with visible progress. Never a single tap. */
const HOLD_DURATION_MS = 3_000;
const HOLD_TICK_MS = 50;

/** Spec §3: 5 s cancel window after sending. */
/**
 * Re-exported from the model rather than defined here: `AI8` specifies one
 * cancel window, and two copies of it would eventually disagree.
 */
const CANCEL_WINDOW_SECONDS = SOS_CANCEL_WINDOW_SECONDS;

type SendMode = 'call-and-alert' | 'alert-only';

export default function SOSScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const { triggerSOS, resolveSOS } = useSOS();
  const { members } = useFamily();
  // Set when the user reached here by completing the three-second hold on the
  // SOS bar (screens 01/06/07). That hold *is* the confirmation, so asking
  // them to hold a second time would be a worse trade in an emergency than
  // the five-second cancel window this screen already gives them.
  const { autosend, tier } = useLocalSearchParams<{ autosend?: string; tier?: string }>();

  /**
   * How far the hold that opened this screen got (`AI8`).
   *
   * Tier 2 means the user deliberately held on past the point that alerted
   * their guardians, which is an unambiguous request for emergency services —
   * so the mode is already chosen for them. Making someone who held for six
   * seconds then pick from a list would waste the intent they just expressed.
   */
  const holdTier = (Number(tier) || 1) as SOSTier;

  const [holdProgress, setHoldProgress] = useState(0);
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<Date | null>(null);
  const [cancelSeconds, setCancelSeconds] = useState(CANCEL_WINDOW_SECONDS);
  const [mode, setMode] = useState<SendMode>(holdTier >= 2 ? 'call-and-alert' : 'alert-only');
  const [silent, setSilent] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Guards against the hold completing twice if a stray tick lands while the
  // send is already in flight.
  const firedRef = useRef(false);
  const autoSentRef = useRef(false);

  const guardians = useMemo(() => joinGuardianNames(members), [members]);

  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  useEffect(() => clearHold, [clearHold]);

  const send = useCallback(async () => {
    setSending(true);
    try {
      await triggerSOS();
      setSentAt(new Date());
      setCancelSeconds(CANCEL_WINDOW_SECONDS);
    } catch {
      // A failed write is queued offline by SOSService; the user still needs
      // to see that their hold registered, so this still counts as sent.
      setSentAt(new Date());
    } finally {
      setSending(false);
    }
  }, [triggerSOS]);

  // Arriving with a completed hold behind us — send immediately.
  useEffect(() => {
    if (autosend !== 'true' || autoSentRef.current) return;
    autoSentRef.current = true;
    firedRef.current = true;
    setHoldProgress(1);
    void send();
  }, [autosend, send]);

  const handlePressIn = () => {
    if (sending || sentAt) return;
    firedRef.current = false;
    setHoldProgress(0);

    const startedAt = Date.now();
    clearHold();
    holdTimer.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const next = Math.min(elapsed / HOLD_DURATION_MS, 1);
      setHoldProgress(next);

      if (next >= 1 && !firedRef.current) {
        firedRef.current = true;
        clearHold();
        void send();
      }
    }, HOLD_TICK_MS);
  };

  const handlePressOut = () => {
    clearHold();
    // Releasing before the ring completes sends nothing — that's the whole
    // point of a hold, and the copy under the button promises it explicitly.
    if (!firedRef.current) setHoldProgress(0);
  };

  // Post-send cancel window, then hand over to the emergency-mode screen.
  // Resolved once and used for both the call and the text describing it —
  // telling someone we will dial one number and dialling another would be
  // the worst possible place for a mismatch.
  const emergencyNumber = localEmergencyNumber();

  useEffect(() => {
    if (!sentAt || cancelling) return;

    const id = setInterval(() => {
      setCancelSeconds((remaining) => {
        if (remaining > 1) return remaining - 1;
        clearInterval(id);
        if (mode === 'call-and-alert') {
          // Placing the call is the user's action, not something the app does
          // silently — Linking opens the dialer with the number prefilled.
          Linking.openURL(
            Platform.OS === 'ios' ? `tel://${emergencyNumber}` : `tel:${emergencyNumber}`,
          ).catch(() => {});
        }
        router.replace('/(app)/emergency-mode');
        return 0;
      });
    }, 1_000);

    return () => clearInterval(id);
  }, [sentAt, cancelling, mode, router, emergencyNumber]);

  /**
   * Cancel. Before sending this is just "close"; after sending it resolves the
   * alert, which is the spec's five-second cancel window. Resolving is what
   * tells the guardians it was a false alarm — simply navigating away would
   * leave them with a live emergency and no correction.
   */
  // Memoised so the Android back subscription below doesn't tear down and
  // re-register on every tick of the cancel countdown.
  const handleCancel = useCallback(async () => {
    if (!sentAt) {
      goBack();
      return;
    }
    setCancelling(true);
    try {
      await resolveSOS();
    } catch {
      // The resolve is queued offline by SOSService — either way the user
      // must not be stranded on this screen.
    }
    router.replace('/(app)/home');
  }, [sentAt, resolveSOS, router]);

  // Spec §3: "Cancel → previous screen". Android back routes through the same
  // handler so it can't dismiss the screen while leaving a live alert behind.
  useAndroidBack(handleCancel);

  const holdSecondsLeft = Math.max(0, Math.ceil((1 - holdProgress) * (HOLD_DURATION_MS / 1_000)));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Emergency</Text>
          <TouchableOpacity
            style={styles.cancelChip}
            onPress={handleCancel}
            disabled={cancelling}
            accessibilityRole="button"
            accessibilityLabel={
              sentAt ? 'Cancel this SOS and tell your guardians it was a false alarm' : 'Close'
            }
          >
            <Text style={styles.cancelChipText}>{cancelling ? 'Cancelling…' : 'Cancel'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonWrap}>
          <CountdownRing
            size={260}
            strokeWidth={16}
            progress={sentAt ? 1 : holdProgress}
            color={SOS.redBright}
            trackColor={SOS.redDim}
          >
            <Pressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={sending || sentAt !== null}
              style={({ pressed }) => [styles.sosButton, pressed && styles.sosButtonPressed]}
              accessibilityRole="button"
              accessibilityLabel={
                sentAt
                  ? `SOS sent. ${cancelSeconds} seconds to cancel.`
                  : 'Press and hold for three seconds to send an SOS'
              }
            >
              <Text style={styles.sosLabel}>SOS</Text>
              <Text style={styles.sosSubLabel}>
                {sentAt
                  ? 'Sent'
                  : sending
                    ? 'Sending…'
                    : holdProgress > 0
                      ? `Keep holding… ${holdSecondsLeft}`
                      : 'Press and hold'}
              </Text>
            </Pressable>
          </CountdownRing>
        </View>

        {sentAt ? (
          <>
            <Text style={styles.holdHint}>
              {members.length > 0 ? `Sent to ${guardians}.` : 'Alert sent.'}{' '}
              {mode === 'call-and-alert'
                ? `Calling ${emergencyNumber} in ${cancelSeconds}s.`
                : `Opening emergency mode in ${cancelSeconds}s.`}{' '}
              Tap Cancel if this was a mistake.
            </Text>
            <TouchableOpacity
              style={styles.undoButton}
              onPress={() => router.replace('/(app)/emergency-mode')}
              accessibilityRole="button"
              accessibilityLabel="Skip the wait and go to emergency mode now"
            >
              <Text style={styles.undoButtonText}>Go to emergency mode now</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.holdHint}>Lift your finger to stop. Nothing is sent yet.</Text>
        )}

        <Text style={styles.sectionLabel}>When it sends</Text>

        <ModeOption
          selected={mode === 'call-and-alert'}
          onPress={() => setMode('call-and-alert')}
          title={`Call ${emergencyNumber} and alert guardians`}
          subtitle={`${guardians} get your live location`}
        />
        <ModeOption
          selected={mode === 'alert-only'}
          onPress={() => setMode('alert-only')}
          title="Alert guardians only"
          subtitle={null}
        />

        <View style={styles.silentRow}>
          <View style={styles.silentText}>
            <Text style={styles.optionTitle}>Silent mode</Text>
            <Text style={styles.optionSubtitle}>No sound, screen dims after sending</Text>
          </View>
          <Switch
            value={silent}
            onValueChange={setSilent}
            trackColor={{ false: SOS.border, true: SOS.redBright }}
            thumbColor={SOS.background}
            accessibilityLabel="Silent mode"
          />
        </View>

        <Text style={styles.footnote}>
          After sending you have {CANCEL_WINDOW_SECONDS} seconds to cancel. Location updates every
          10 s until you or a guardian ends it.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeOption({
  selected,
  onPress,
  title,
  subtitle,
}: {
  selected: boolean;
  onPress(): void;
  title: string;
  subtitle: string | null;
}) {
  return (
    <TouchableOpacity
      style={[styles.option, selected && styles.optionSelected]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioDot} />}
      </View>
      <View style={styles.optionText}>
        <Text style={styles.optionTitle}>{title}</Text>
        {subtitle && <Text style={styles.optionSubtitle}>{subtitle}</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: SOS.background },
  container: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
    gap: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 30,
    fontFamily: FONTS.headingXBold,
    color: SOS.text,
    letterSpacing: -0.5,
  },
  cancelChip: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: SOS.border,
  },
  cancelChipText: {
    fontSize: 17,
    fontFamily: FONTS.bodySemibold,
    color: SOS.text,
  },
  buttonWrap: {
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  sosButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SOS.red,
  },
  sosButtonPressed: {
    backgroundColor: SOS.redPressed,
  },
  sosLabel: {
    fontSize: 52,
    fontFamily: FONTS.headingXBold,
    color: SOS.text,
    letterSpacing: 1,
  },
  sosSubLabel: {
    fontSize: 15,
    fontFamily: FONTS.bodySemibold,
    color: SOS.text,
    marginTop: SPACING.xs,
  },
  holdHint: {
    fontSize: 16,
    fontFamily: FONTS.body,
    color: SOS.textMuted,
    textAlign: 'center',
    lineHeight: 23,
  },
  undoButton: {
    alignSelf: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  undoButtonText: {
    fontSize: 16,
    fontFamily: FONTS.bodySemibold,
    color: SOS.redBright,
  },
  sectionLabel: {
    fontSize: 16,
    fontFamily: FONTS.bodySemibold,
    color: SOS.text,
    marginTop: SPACING.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: SOS.border,
    backgroundColor: SOS.surface,
  },
  optionSelected: {
    borderColor: SOS.redBright,
    borderWidth: 1.5,
  },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: SOS.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: SOS.redBright,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SOS.redBright,
  },
  optionText: { flex: 1, gap: 2 },
  optionTitle: {
    fontSize: 17,
    fontFamily: FONTS.bodySemibold,
    color: SOS.text,
  },
  optionSubtitle: {
    fontSize: 15,
    fontFamily: FONTS.body,
    color: SOS.textMuted,
  },
  silentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: SOS.border,
    backgroundColor: SOS.surface,
  },
  silentText: { flex: 1, gap: 2 },
  footnote: {
    fontSize: 15,
    fontFamily: FONTS.body,
    color: SOS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: SPACING.xl,
  },
});
