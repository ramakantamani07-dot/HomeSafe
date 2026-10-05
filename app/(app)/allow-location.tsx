import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../src/config/theme';
import { useJourneyDraft } from '../../src/context/JourneyDraftContext';
import { useJourney } from '../../src/hooks/useJourney';
import { usePlaces } from '../../src/hooks/usePlaces';
import { usePrivacy } from '../../src/hooks/usePrivacy';
import { useFamily } from '../../src/hooks/useFamily';
import { Button } from '../../src/components/ui/Button';
import { Icon } from '../../src/components/ui/Icon';
import { joinGuardianNames } from '../../src/utils/guardians';

/**
 * Screen 05 — "Let <guardians> follow your journey".
 *
 * Shown once, immediately before the OS permission dialog, and only when
 * permission is actually missing (screen 04 decides that). The point is that
 * the system prompt is a yes/no with no room to explain *why* background
 * location matters — so the explanation happens here, where a "no" costs
 * nothing and can be reconsidered.
 *
 * "Continue" requests permission and then starts the journey, so the user
 * isn't dumped back on screen 04 to press Start a second time.
 */
export default function AllowLocationScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();

  const { draft, reset } = useJourneyDraft();
  const { startJourney } = useJourney();
  const { savePlace, isAlreadySaved } = usePlaces();
  const { requestLocationPermission } = usePrivacy();
  const { members } = useFamily();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardians = useMemo(() => joinGuardianNames(members), [members]);

  const handleContinue = async () => {
    setBusy(true);
    setError(null);

    try {
      const status = await requestLocationPermission();
      if (status !== 'granted') {
        setError(
          "Location is off, so we can't follow your route. You can turn it on in Settings, or go back and start without sharing.",
        );
        setBusy(false);
        return;
      }

      const destination = draft.destination;
      if (!destination) {
        // Permission is granted now — send them back to pick a destination
        // rather than silently doing nothing.
        router.replace('/(app)/where-to');
        return;
      }

      if (draft.saveAsPlace && !isAlreadySaved(destination)) {
        await savePlace(destination.name, destination, 'custom', draft.arrivalRadiusMeters).catch(
          () => {},
        );
      }

      await startJourney({
        destination,
        savedPlaceId: draft.savedPlaceId,
        travelMode: draft.travelMode,
        alertRules: draft.alertRules,
        arrivalRadiusMeters: draft.arrivalRadiusMeters,
      });

      reset();
      router.replace('/(app)/active-journey');
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Could not start the journey. Please try again.',
      );
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Icon name="chevronLeft" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.iconCircle}>
          <Icon name="location" size={32} color={theme.accent} />
        </View>

        <Text style={styles.title}>Let {guardians} follow your journey</Text>
        <Text style={styles.body}>
          wayLoc needs your location to share your route and spot if something's wrong.
        </Text>

        <View style={styles.card}>
          <Benefit styles={styles} theme={theme}>
            Only shared <Text style={styles.benefitStrong}>during a journey</Text>
          </Benefit>
          <Benefit styles={styles} theme={theme}>Stops automatically when you arrive</Benefit>
          <Benefit styles={styles} theme={theme}>Keeps working with your screen off</Benefit>
        </View>

        <View style={styles.amberBox}>
          <Text style={styles.amberText}>
            {Platform.OS === 'ios' ? (
              <>
                On the next screen choose <Text style={styles.amberStrong}>"Allow While Using
                App"</Text>, then <Text style={styles.amberStrong}>"Change to Always Allow"</Text>{' '}
                when we ask. Otherwise tracking stops when your phone is locked.
              </>
            ) : (
              <>
                On the next screen choose <Text style={styles.amberStrong}>"Allow all the
                time"</Text>. Otherwise tracking stops when your phone is locked.
              </>
            )}
          </Text>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Continue" variant="strong" onPress={handleContinue} loading={busy} />
        <TouchableOpacity
          onPress={() => router.back()}
          disabled={busy}
          style={styles.notNowButton}
          accessibilityRole="button"
          accessibilityLabel="Not now"
        >
          <Text style={styles.notNowText}>Not now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Benefit({
  styles,
  theme,
  children,
}: {
  styles: ReturnType<typeof getStyles>;
  theme: ThemeColors;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.benefitRow}>
      <Icon name="check" size={20} color={theme.accent} />
      <Text style={styles.benefitText}>{children}</Text>
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    headerRow: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.md,
    },
    container: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.xl,
      paddingBottom: SPACING.xl,
      gap: SPACING.lg,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentMuted,
    },
    title: {
      fontSize: 34,
      lineHeight: 40,
      fontFamily: FONTS.headingXBold,
      color: theme.textPrimary,
      letterSpacing: -0.6,
      marginTop: SPACING.sm,
    },
    body: {
      fontSize: 17,
      lineHeight: 24,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.xl,
      padding: SPACING.lg,
      gap: SPACING.lg,
      marginTop: SPACING.sm,
    },
    benefitRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.md,
    },
    benefitText: {
      flex: 1,
      fontSize: 17,
      lineHeight: 23,
      fontFamily: FONTS.body,
      color: theme.textPrimary,
    },
    benefitStrong: {
      fontFamily: FONTS.bodySemibold,
    },
    amberBox: {
      backgroundColor: theme.warmMuted,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
    },
    amberText: {
      fontSize: 16,
      lineHeight: 23,
      fontFamily: FONTS.body,
      color: theme.warning.fg,
    },
    amberStrong: {
      fontFamily: FONTS.bodySemibold,
    },
    errorText: {
      fontSize: 15,
      lineHeight: 21,
      fontFamily: FONTS.body,
      color: theme.critical.fg,
    },
    footer: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.lg,
      gap: SPACING.xs,
    },
    notNowButton: {
      alignItems: 'center',
      paddingVertical: SPACING.lg,
    },
    notNowText: {
      fontSize: 17,
      fontFamily: FONTS.bodySemibold,
      color: theme.textSecondary,
    },
  });
}
