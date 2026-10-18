import React from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../src/context/ThemeContext';
import { FONTS, SPACING, TYPOGRAPHY, type ThemeColors } from '../../src/config/theme';
import { localEmergencyNumber } from '../../src/config/markets';
import { useGoBack } from '../../src/hooks/useGoBack';
import { useHandsFreeSos } from '../../src/hooks/useHandsFreeSos';
import {
  SIRI_PHRASES,
  SIRI_PHRASES_HINDI,
  SIRI_PHRASES_INDIAN_ENGLISH,
} from '../../src/models/HandsFreeSos';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { ListRow, Section } from '../../src/components/ui/Section';
import { Button } from '../../src/components/ui/Button';

/**
 * Hands-free SOS: "Siri, WayLoc help me", the Action Button and Back Tap
 * (docs/features/hands-free-sos.md). Only what is true is shown: WayLoc cannot
 * read Siri's settings, so it explains them instead of claiming they are on.
 */
export default function HandsFreeSosScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const goBack = useGoBack();
  const { available, enabled, busy, enable, disable, startTest, endTest } = useHandsFreeSos();
  const emergency = localEmergencyNumber();

  const toggle = async (on: boolean) => {
    try {
      if (on) await enable();
      else await disable();
    } catch (err) {
      Alert.alert(
        on ? "Couldn't turn on hands-free SOS" : "Couldn't turn it off",
        err instanceof Error ? err.message : 'Check your connection and try again.',
      );
    }
  };

  const test = () => {
    if (!startTest()) return;
    Alert.alert(
      'Test for 10 minutes',
      'Lock your phone and say "Siri, WayLoc help me". Siri will check everything works. Nobody is alerted during the test.',
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Hands-free SOS"
        subtitle="Ask Siri for help without unlocking your phone"
        onBack={goBack}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {!available ? (
          <Section>
            <View style={styles.card}>
              <Text style={styles.body}>
                Hands-free SOS works through Siri on iPhone, with iOS 17 or later. It isn't available on this phone yet.
                The SOS button and the Lock Screen widget still work.
              </Text>
            </View>
          </Section>
        ) : (
          <>
            <Section footer="Sends an SOS with your location to your trusted contacts, exactly like the SOS button. Turning this off removes its key from this phone.">
              <ListRow
                icon="sos"
                title="Hands-free SOS"
                subtitle={enabled ? 'On for this phone' : 'Off'}
                accessory={
                  <Switch
                    value={enabled}
                    disabled={busy}
                    onValueChange={(on) => void toggle(on)}
                    accessibilityLabel="Hands-free SOS"
                  />
                }
              />
            </Section>

            <Section title="Say to Siri">
              {SIRI_PHRASES.map((phrase) => (
                <ListRow key={phrase} icon="mic" title={`“Siri, ${phrase}”`} />
              ))}
            </Section>

            <Section
              title="In Hindi, or Indian English"
              footer="Heard when Siri's language is Hindi or English (India). Change it in Settings › Siri › Language."
            >
              {[...SIRI_PHRASES_HINDI, ...SIRI_PHRASES_INDIAN_ENGLISH].map((phrase) => (
                <ListRow key={phrase} icon="mic" title={`“Siri, ${phrase}”`} />
              ))}
            </Section>

            <Section
              title="Set up once"
              footer="WayLoc can't check these settings for you, so it's worth a test."
            >
              <ListRow
                icon="lock"
                title="Allow Siri when locked"
                subtitle="Settings › Siri › Allow Siri When Locked"
              />
              <ListRow
                icon="sos"
                title="Action Button (optional)"
                subtitle="Settings › Action Button › Shortcut › WayLoc › Send SOS"
              />
              <ListRow
                icon="sos"
                title="Back Tap (optional)"
                subtitle="Settings › Accessibility › Touch › Back Tap › Send SOS"
              />
            </Section>

            {enabled && (
              <Section title="Test it" footer={`If Siri can't reach WayLoc, it tells you to call ${emergency}.`}>
                <View style={styles.card}>
                  <Button label="Start a 10-minute test" variant="secondary" onPress={test} />
                  <Button label="End the test now" variant="ghost" onPress={() => void endTest()} />
                </View>
              </Section>
            )}
          </>
        )}
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
      paddingBottom: SPACING.xxxl,
    },
    card: {
      padding: SPACING.lg,
      gap: SPACING.sm,
      backgroundColor: theme.surface,
    },
    body: {
      fontFamily: FONTS.body,
      fontSize: TYPOGRAPHY.body.fontSize,
      lineHeight: TYPOGRAPHY.body.lineHeight,
      color: theme.textPrimary,
    },
  });
}
