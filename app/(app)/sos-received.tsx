import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { FONTS, SPACING, TYPOGRAPHY, type ThemeColors } from '../../src/config/theme';
import { localEmergencyNumber } from '../../src/config/markets';
import { useGoBack } from '../../src/hooks/useGoBack';
import { useSOS } from '../../src/hooks/useSOS';
import type { AcknowledgeOutcome } from '../../src/models/SOS';
import { callNumber, openDirections } from '../../src/utils/deviceLinks';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { ListRow, Section } from '../../src/components/ui/Section';
import { Button } from '../../src/components/ui/Button';

/**
 * Someone's SOS, as their trusted contact or family member sees it — reached
 * from the SOS notification, with "I'm on it" on the notification itself or
 * here (functions/src/sos/escalation.ts).
 *
 * "I'm on it" tells them you are responding and stops the reminders to
 * everyone else. It is not "they're safe": only they can end their SOS.
 */
export default function SosReceivedScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const goBack = useGoBack();
  const { acknowledgeSOS } = useSOS();
  const params = useLocalSearchParams<{ ownerId?: string; sosId?: string; name?: string; location?: string; ack?: string }>();
  const name = params.name?.trim() || 'Someone';
  const emergency = localEmergencyNumber();

  const [outcome, setOutcome] = useState<AcknowledgeOutcome | 'error' | null>(null);
  const [sending, setSending] = useState(false);

  const [lat, lng] = (params.location ?? '').split(',').map(Number);
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lng) && params.location !== '';

  const respond = async () => {
    if (!params.ownerId || !params.sosId || sending) return;
    setSending(true);
    try {
      setOutcome(await acknowledgeSOS(params.ownerId, params.sosId));
    } catch {
      setOutcome('error');
    } finally {
      setSending(false);
    }
  };

  // Tapped "I'm on it" on the notification: send it straight away, once.
  const autoSent = useRef(false);
  useEffect(() => {
    if (params.ack === '1' && !autoSent.current) {
      autoSent.current = true;
      void respond();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.ack]);

  const status: Record<AcknowledgeOutcome | 'error', string> = {
    acknowledged: `${name} has been told you're responding.`,
    already: `You've already told ${name} you're responding.`,
    'not-active': `${name}'s SOS has ended.`,
    'not-allowed': `Only ${name}'s trusted contacts and family can respond to this SOS.`,
    'not-found': `This SOS couldn't be found.`,
    error: "Couldn't reach WayLoc. Check your connection and try again.",
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={`${name} needs help`} subtitle="They pressed SOS in WayLoc" onBack={goBack} />
      <ScrollView contentContainerStyle={styles.content}>
        {outcome && (
          <View style={styles.status} accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Text style={styles.statusText}>{status[outcome]}</Text>
          </View>
        )}

        {outcome !== 'acknowledged' && outcome !== 'already' && outcome !== 'not-active' && (
          <Button
            label="I'm on it"
            variant="destructive"
            onPress={() => void respond()}
            loading={sending}
            accessibilityHint={`Tells ${name} you're responding and stops the reminders to everyone else`}
          />
        )}

        <Section>
          {hasLocation ? (
            <ListRow
              icon="location"
              title="Last known location"
              subtitle="Open directions in Maps"
              onPress={() => openDirections(lat, lng, name)}
            />
          ) : (
            <ListRow icon="location" title="No location came with this alert" />
          )}
          <ListRow
            icon="call"
            title={`Call ${emergency}`}
            subtitle="If you think they're in danger"
            onPress={() => callNumber(emergency)}
          />
        </Section>

        <Text style={styles.note}>
          "I'm on it" means you've seen this and are acting. It doesn't end {name}'s SOS — only they can.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      padding: SPACING.lg,
      gap: SPACING.lg,
      paddingBottom: SPACING.xxxl,
    },
    status: {
      padding: SPACING.lg,
      borderRadius: 14,
      backgroundColor: theme.surface,
    },
    statusText: {
      fontFamily: FONTS.bodySemibold,
      fontSize: TYPOGRAPHY.body.fontSize,
      color: theme.textPrimary,
    },
    note: {
      fontFamily: FONTS.body,
      fontSize: TYPOGRAPHY.callout.fontSize,
      lineHeight: TYPOGRAPHY.callout.lineHeight,
      color: theme.textSecondary,
    },
  });
}
