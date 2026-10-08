import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../context/ThemeContext';
import { localEmergencyNumber } from '../../config/markets';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
import { useSafetyCheck } from '../../hooks/useSafetyCheck';
import { useJourney } from '../../hooks/useJourney';
import { useAuth } from '../../hooks/useAuth';
import { useFamily } from '../../hooks/useFamily';
import { joinGuardianNames } from '../../utils/guardians';
import { describeSafetyCheckReason } from '../../models/AlertRules';
import { SAFETY_CHECK_EXTENSION_MINUTES } from '../../models/SafetyCheck';
import { Button } from '../ui/Button';
import { CountdownRing } from '../ui/CountdownRing';

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(Math.max(totalSeconds, 0) / 60);
  const s = Math.max(totalSeconds, 0) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Screen 08 — "Are you OK, <name>?"
 *
 * Rendered as a full-screen modal over whatever the user was doing (06 or 07,
 * per the flow map) rather than as a route, because it is raised by a
 * background detector and must appear regardless of where navigation
 * currently sits — including over the Home tab.
 *
 * The three outcomes are deliberately unequal in weight: "I'm OK" is the big
 * green affirmative, "Add 15 min" is a quiet secondary, and "I need help"
 * is outlined in red so it can't be hit by accident but is never more than
 * one tap away.
 */
export function SafetyCheckOverlay() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const emergencyNumber = localEmergencyNumber();
  const router = useRouter();

  const { activeCheck, reason, secondsUntilEscalation, hasEscalated, confirmOk, addTime } =
    useSafetyCheck();
  const { activeJourney } = useJourney();
  const { user } = useAuth();
  const { members } = useFamily();

  const [busy, setBusy] = useState<'ok' | 'extend' | null>(null);

  const guardians = useMemo(() => joinGuardianNames(members), [members]);
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  if (!activeCheck || !reason) return null;

  const rules = activeJourney?.alertRules ?? null;
  const explanation = rules
    ? describeSafetyCheckReason(reason, rules, null)
    : 'Something looks different about your journey — just let us know.';

  const totalSeconds = (rules?.noReplyMinutes ?? 2) * 60;
  const countdownLabel = formatMMSS(secondsUntilEscalation);

  const handleOk = async () => {
    setBusy('ok');
    try { await confirmOk(); } finally { setBusy(null); }
  };

  const handleExtend = async () => {
    setBusy('extend');
    try { await addTime(); } finally { setBusy(null); }
  };

  const handleNeedHelp = async () => {
    // Acknowledge the check first so it stops counting down behind the SOS
    // screen, then hand off. SOS is the user's explicit answer to "are you
    // OK?", so leaving the check pending would double-alert the guardians.
    await confirmOk();
    router.push('/(app)/sos');
  };

  return (
    <Modal visible transparent={false} animationType="fade" statusBarTranslucent>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Safety check</Text>
          </View>

          <Text style={styles.title}>Are you OK, {firstName}?</Text>
          <Text style={styles.body}>{explanation}</Text>

          <View style={styles.countdownRow}>
            <CountdownRing
              size={140}
              strokeWidth={14}
              progress={totalSeconds > 0 ? secondsUntilEscalation / totalSeconds : 0}
              color={theme.warning.fg}
              trackColor={theme.warmMuted}
            >
              <Text style={styles.countdownText}>{countdownLabel}</Text>
            </CountdownRing>

            <Text style={styles.countdownCaption}>
              {hasEscalated ? (
                <>
                  We've alerted <Text style={styles.bold}>{guardians}</Text> with your location.
                  Let them know you're safe.
                </>
              ) : (
                <>
                  If you don't answer, we'll alert <Text style={styles.bold}>{guardians}</Text>{' '}
                  with your location.
                </>
              )}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>What happens next</Text>

            <Step styles={styles} theme={theme} index={1} active={!hasEscalated}>
              <Text style={styles.stepStrong}>Now</Text> — we're asking you. Your phone will buzz
              again in 30 s.
            </Step>
            <Step styles={styles} theme={theme} index={2} active={hasEscalated}>
              <Text style={styles.stepStrong}>
                {hasEscalated ? 'Done' : `In ${countdownLabel}`}
              </Text>{' '}
              — {guardians} get an alert, your live location and battery.
            </Step>
            <Step styles={styles} theme={theme} index={3} active={false}>
              <Text style={styles.stepStrong}>Then</Text> — they can call you, or call{' '}
              {emergencyNumber} for you.
            </Step>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="I'm OK — carry on"
            variant="safe"
            onPress={handleOk}
            loading={busy === 'ok'}
            disabled={busy !== null}
          />
          <View style={styles.secondaryRow}>
            <Button
              label={`Add ${SAFETY_CHECK_EXTENSION_MINUTES} min`}
              variant="secondary"
              onPress={handleExtend}
              loading={busy === 'extend'}
              disabled={busy !== null}
              style={styles.secondaryHalf}
            />
            <TouchableOpacity
              style={styles.helpButton}
              onPress={handleNeedHelp}
              disabled={busy !== null}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="I need help — open emergency SOS"
            >
              <Text style={styles.helpButtonText}>I need help</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function Step({
  styles,
  theme,
  index,
  active,
  children,
}: {
  styles: ReturnType<typeof getStyles>;
  theme: ThemeColors;
  index: number;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.stepRow}>
      <View
        style={[
          styles.stepNumber,
          { backgroundColor: active ? theme.warning.fg : theme.border },
        ]}
      >
        <Text
          style={[
            styles.stepNumberText,
            { color: active ? theme.textOnColor : theme.textSecondary },
          ]}
        >
          {index}
        </Text>
      </View>
      <Text style={styles.stepText}>{children}</Text>
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      // The warm amber wash from the design — this screen must read as
      // "attention", distinct from both the calm neutral background and the
      // red reserved for SOS.
      backgroundColor: theme.isDark ? theme.background : theme.attention.bg,
    },
    container: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.xl,
      paddingBottom: SPACING.lg,
      gap: SPACING.lg,
    },
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: SPACING.md,
      paddingVertical: 6,
      borderRadius: RADIUS.pill,
      backgroundColor: theme.isDark ? theme.warning.bg : theme.warmMuted,
    },
    badgeText: {
      fontSize: 14,
      fontFamily: FONTS.bodySemibold,
      color: theme.warning.fg,
    },
    title: {
      fontSize: 34,
      lineHeight: 40,
      fontFamily: FONTS.headingXBold,
      color: theme.textPrimary,
      letterSpacing: -0.6,
    },
    body: {
      fontSize: 17,
      lineHeight: 24,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    countdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.lg,
      marginVertical: SPACING.sm,
    },
    countdownText: {
      fontSize: 28,
      fontFamily: FONTS.headingXBold,
      color: theme.textPrimary,
    },
    countdownCaption: {
      flex: 1,
      fontSize: 16,
      lineHeight: 23,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    bold: {
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.xl,
      padding: SPACING.lg,
      gap: SPACING.lg,
    },
    cardTitle: {
      fontSize: 17,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.md,
    },
    stepNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNumberText: {
      fontSize: 14,
      fontFamily: FONTS.bodySemibold,
    },
    stepText: {
      flex: 1,
      fontSize: 16,
      lineHeight: 23,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    stepStrong: {
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
    footer: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.lg,
      gap: SPACING.md,
    },
    secondaryRow: {
      flexDirection: 'row',
      gap: SPACING.md,
    },
    secondaryHalf: {
      flex: 1,
      backgroundColor: theme.surface,
    },
    helpButton: {
      flex: 1,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: RADIUS.pill,
      borderWidth: 1.5,
      borderColor: theme.critical.fg,
      backgroundColor: theme.critical.bg,
    },
    helpButtonText: {
      fontSize: 16,
      fontFamily: FONTS.bodySemibold,
      color: theme.critical.fg,
    },
  });
}
