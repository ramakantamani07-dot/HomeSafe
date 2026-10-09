import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { SPACING, TYPOGRAPHY } from '../../src/config/theme';
import { useSOS } from '../../src/hooks/useSOS';
import { usePrivacy } from '../../src/hooks/usePrivacy';
import { PinEntryModal } from '../../src/components/security/PinEntryModal';
import { Icon } from '../../src/components/ui/Icon';
import { Button } from '../../src/components/ui/Button';
import { Section, ListRow } from '../../src/components/ui/Section';
import { formatCoordinates } from '../../src/models/Journey';
import { sosFallbackText } from '../../src/models/SOS';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import { useContacts } from '../../src/hooks/useContacts';
import { textMany } from '../../src/utils/deviceLinks';

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function EmergencyModeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { activeSOS, isSOSLoading, resolveSOSWithAuth, resolveStage, triggerDuress } = useSOS();
  const { verifyDuressCode } = usePrivacy();
  const { isOffline } = useNetworkStatus();
  const { contacts } = useContacts();
  const resolving = resolveStage === 'authenticating' || resolveStage === 'resolving';
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  // If there is no active SOS (already resolved, or navigated here incorrectly), go home.
  useEffect(() => {
    if (!isSOSLoading && !activeSOS) {
      router.replace('/(app)/home');
    }
  }, [activeSOS, isSOSLoading, router]);

  const handleCodeSubmit = async (pin: string) => {
    const matches = await verifyDuressCode(pin);
    if (!matches) {
      setCodeError('Incorrect code.');
      return;
    }
    setShowCodeEntry(false);
    setCodeError(null);
    // Looks identical to a real resolve from here: navigation is driven by
    // the same useEffect watching activeSOS → null. See useSOS.triggerDuress.
    await triggerDuress();
  };

  if (isSOSLoading || !activeSOS) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.critical.bg }]} edges={['top', 'bottom']}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color={theme.critical.fg} />
        </View>
      </SafeAreaView>
    );
  }

  const handleResolve = () => {
    Alert.alert(
      'Resolve SOS',
      'Are you safe? This will end the SOS alert and close your active journey.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, I am safe',
          onPress: async () => {
            const result = await resolveSOSWithAuth();
            // On success, navigation is driven by the useEffect that watches
            // activeSOS → null.
            if (!result.success && result.error) {
              Alert.alert('Error', result.error);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.critical.bg }]} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={[styles.iconCircle, { backgroundColor: theme.critical.fg }]}>
          <Icon name="sos" size={40} color={theme.textOnColor} />
        </View>

        <Text style={[styles.title, { color: theme.critical.fg }]}>SOS Active</Text>
        {/* Offline, the alert is queued on this phone, not delivered — saying
            "notified" then would be the most dangerous untrue sentence in
            the app. It goes the moment a connection returns. */}
        <Text style={[styles.subtitle, { color: theme.textPrimary }]}>
          {isOffline
            ? "No data signal — wayLoc will alert your contacts the moment it reconnects. Text them now as well."
            : 'Your trusted contacts have been notified.\nYour location is being shared.'}
        </Text>

        {contacts.length > 0 && (
          <Button
            label={isOffline ? 'Text my contacts now' : 'Also text my contacts'}
            icon="message"
            variant={isOffline ? 'destructive' : 'secondary'}
            onPress={() => textMany(contacts.map((c) => c.phone), sosFallbackText(activeSOS.location))}
            style={styles.resolveButton}
            accessibilityHint="Opens Messages with your emergency contacts and your location filled in"
          />
        )}

        <Section>
          <ListRow
            icon="time"
            title="Triggered"
            value={`${formatDate(activeSOS.triggeredAt)} · ${formatTime(activeSOS.triggeredAt)}`}
          />
          {activeSOS.journeyId && (
            <ListRow icon="compass" title="Journey" value="Active when triggered" />
          )}
          {activeSOS.location && (
            <ListRow icon="location" title="Last location" value={formatCoordinates(activeSOS.location)} />
          )}
        </Section>

        <Text style={[styles.emergencyNote, { color: theme.textSecondary }]}>
          If you are in danger, please contact emergency services directly.
        </Text>

        <Button
          label="I am safe — Resolve SOS"
          onPress={handleResolve}
          variant="safe"
          loading={resolving}
          style={styles.resolveButton}
          accessibilityHint="Ends the SOS alert and notifies your contacts you are safe"
        />

        <TouchableOpacity
          onPress={() => { setCodeError(null); setShowCodeEntry(true); }}
          activeOpacity={0.7}
          style={styles.codeLinkButton}
          accessibilityRole="button"
        >
          <Text style={[styles.codeLinkText, { color: theme.textSecondary }]}>Enter code instead</Text>
        </TouchableOpacity>
      </ScrollView>

      <PinEntryModal
        visible={showCodeEntry}
        title="Enter Code"
        description="Enter your resolve code."
        confirmLabel="Submit"
        errorText={codeError}
        onSubmit={handleCodeSubmit}
        onCancel={() => setShowCodeEntry(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    padding: SPACING.xl,
    paddingBottom: SPACING.xxxl,
    alignItems: 'center',
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: TYPOGRAPHY.title.fontSize,
    fontWeight: TYPOGRAPHY.title.fontWeight,
    letterSpacing: -0.3,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.body.fontSize,
    lineHeight: TYPOGRAPHY.body.lineHeight,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  emergencyNote: {
    fontSize: TYPOGRAPHY.callout.fontSize,
    lineHeight: TYPOGRAPHY.callout.lineHeight,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  resolveButton: {
    width: '100%',
  },
  codeLinkButton: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  codeLinkText: {
    fontSize: TYPOGRAPHY.caption.fontSize,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
