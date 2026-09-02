import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { COLORS } from '../../src/config/constants';
import { useAuth } from '../../src/hooks/useAuth';
import { useJourney } from '../../src/hooks/useJourney';
import { useSOS } from '../../src/hooks/useSOS';
import { useFakeCall } from '../../src/hooks/useFakeCall';
import { SOSButton } from '../../src/components/SOSButton';

export default function HomeScreen() {
  const { user } = useAuth();
  const { activeJourney, isLoading: journeyLoading } = useJourney();
  const { activeSOS, isSOSLoading, triggerSOS } = useSOS();
  const { startFakeCall } = useFakeCall();
  const router = useRouter();

  // If an SOS is already active (e.g. app restarted mid-SOS), go straight to emergency mode.
  useEffect(() => {
    if (!isSOSLoading && activeSOS) {
      router.replace('/(app)/emergency-mode');
    }
  }, [activeSOS, isSOSLoading, router]);

  const handleQuickFakeCall = () => {
    startFakeCall();
    router.push('/(app)/fake-incoming-call');
  };

  const handleSOSTrigger = async () => {
    await triggerSOS();
    router.replace('/(app)/emergency-mode');
  };

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {firstName} 👋</Text>
            <Text style={styles.subGreeting}>You're safe. Stay connected.</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(app)/profile')}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Journey section */}
        {journeyLoading ? (
          // Skeleton while fetching active journey — prevents showing wrong CTA
          <View style={styles.journeyLoadingCard}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : activeJourney ? (
          // Active journey card
          <TouchableOpacity
            style={styles.activeJourneyCard}
            onPress={() => router.push('/(app)/active-journey')}
            activeOpacity={0.85}
          >
            <View style={styles.activeJourneyTop}>
              <View style={styles.activeDot} />
              <Text style={styles.activeLabel}>ACTIVE JOURNEY</Text>
            </View>
            <Text style={styles.activeDestination}>
              📍 {activeJourney.destinationLabel}
            </Text>
            <Text style={styles.activeHint}>Tap to view details or end your journey →</Text>
          </TouchableOpacity>
        ) : (
          // Start journey CTA
          <TouchableOpacity
            style={styles.startCard}
            onPress={() => router.push('/(app)/start-journey')}
            activeOpacity={0.85}
          >
            <Text style={styles.startCardIcon}>🗺️</Text>
            <View style={styles.startCardBody}>
              <Text style={styles.startCardTitle}>Start a Journey</Text>
              <Text style={styles.startCardDesc}>
                Enter your destination and HomeSafe will capture your starting location.
              </Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Profile card */}
        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => router.push('/(app)/profile')}
          activeOpacity={0.8}
        >
          <Text style={styles.profileIcon}>👤</Text>
          <View style={styles.profileTextGroup}>
            <Text style={styles.profileTitle}>
              {user?.name ? user.name : 'Complete your profile'}
            </Text>
            <Text style={styles.profileDesc}>
              Keep your verified phone and name up to date.
            </Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        {/* Fake Call card */}
        <View style={styles.fakeCallCard}>
          <View style={styles.fakeCallTop}>
            <Text style={styles.fakeCallIcon}>📱</Text>
            <View style={styles.fakeCallBody}>
              <Text style={styles.fakeCallTitle}>Fake Call</Text>
              <Text style={styles.fakeCallDesc}>
                Trigger a fake incoming call to discreetly exit an uncomfortable situation.
              </Text>
            </View>
          </View>
          <View style={styles.fakeCallActions}>
            <TouchableOpacity
              style={styles.fakeCallBtn}
              onPress={handleQuickFakeCall}
              activeOpacity={0.85}
            >
              <Text style={styles.fakeCallBtnText}>Call me now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.fakeCallSettingsBtn}
              onPress={() => router.push('/(app)/fake-call-settings')}
              activeOpacity={0.75}
            >
              <Text style={styles.fakeCallSettingsBtnText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SOS section */}
        <View style={styles.sosSection}>
          <Text style={styles.sosHeading}>Emergency</Text>
          <Text style={styles.sosDesc}>
            Tap the SOS button to alert your trusted contacts immediately.
          </Text>
          <SOSButton onTrigger={handleSOSTrigger} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  subGreeting: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
  },
  // Journey loading placeholder
  journeyLoadingCard: {
    height: 96,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Active journey card
  activeJourneyCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  activeJourneyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  activeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1,
  },
  activeDestination: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  activeHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  // Start journey card
  startCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: COLORS.primary + '30',
    borderStyle: 'dashed',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  startCardIcon: {
    fontSize: 32,
  },
  startCardBody: {
    flex: 1,
  },
  startCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  startCardDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  arrow: {
    fontSize: 22,
    color: COLORS.textMuted,
  },
  // Profile card
  profileCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  profileIcon: {
    fontSize: 28,
  },
  profileTextGroup: {
    flex: 1,
  },
  profileTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  profileDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  // Fake Call card
  fakeCallCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: 14,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  fakeCallTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  fakeCallIcon: { fontSize: 28, marginTop: 2 },
  fakeCallBody: { flex: 1 },
  fakeCallTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  fakeCallDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  fakeCallActions: { flexDirection: 'row', gap: 10 },
  fakeCallBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  fakeCallBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  fakeCallSettingsBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fakeCallSettingsBtnText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  // SOS section
  sosSection: {
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  sosHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sosDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
});
