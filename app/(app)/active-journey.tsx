import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { COLORS } from '../../src/config/constants';
import { EXTEND_OPTIONS_MINUTES } from '../../src/models/CheckIn';
import { useJourney } from '../../src/hooks/useJourney';
import { useCheckIn } from '../../src/hooks/useCheckIn';
import { useSOS } from '../../src/hooks/useSOS';
import { SOSButton } from '../../src/components/SOSButton';
import { useActiveJourneyLocation } from '../../src/hooks/useActiveJourneyLocation';
import { useJourneyMap } from '../../src/hooks/useJourneyMap';
import { useRoute } from '../../src/hooks/useRoute';
import { useFakeCall } from '../../src/hooks/useFakeCall';
import { AppMapView } from '../../src/components/map/AppMapView';
import { LowBatteryBanner } from '../../src/components/common/LowBatteryBanner';
import { formatCoordinates } from '../../src/models/Journey';

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(Math.max(totalSeconds, 0) / 60);
  const s = Math.max(totalSeconds, 0) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function ActiveJourneyScreen() {
  const router = useRouter();
  const { activeJourney, isLoading, endJourney, cancelJourney } = useJourney();
  const { currentLocation, isTracking } = useActiveJourneyLocation();
  const mapData = useJourneyMap();
  const { phase, timeRemainingSeconds, graceRemainingSeconds, confirmSafe, extendTimer } =
    useCheckIn();
  const { triggerSOS } = useSOS();
  const { formattedEta, formattedDistance, formattedDuration, isLoading: routeLoading, error: routeError } = useRoute();
  const { startFakeCall } = useFakeCall();

  const [ending, setEnding] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [extendingMinutes, setExtendingMinutes] = useState<number | null>(null);

  const busy = ending || cancelling;

  // While the context is still fetching, don't assume there's no journey.
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.emptyScreen}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Guard: if there is no active journey, show a placeholder and let the user go home.
  if (!activeJourney) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.emptyScreen}>
          <Text style={styles.emptyIcon}>🏁</Text>
          <Text style={styles.emptyTitle}>No active journey</Text>
          <Text style={styles.emptyDesc}>
            Start a journey from the home screen to see it here.
          </Text>
          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => router.replace('/(app)/home')}
            activeOpacity={0.85}
          >
            <Text style={styles.homeButtonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleSOSTrigger = async () => {
    await triggerSOS();
    router.replace('/(app)/emergency-mode');
  };

  const handleConfirmSafe = async () => {
    setConfirming(true);
    try { await confirmSafe(); } catch { /* ignore */ } finally { setConfirming(false); }
  };

  const handleExtend = async (byMinutes: number) => {
    setExtendingMinutes(byMinutes);
    try { await extendTimer(byMinutes); } catch { /* ignore */ } finally { setExtendingMinutes(null); }
  };

  const handleFakeCall = () => {
    startFakeCall();
    router.push('/(app)/fake-incoming-call');
  };

  const handleEnd = () => {
    Alert.alert(
      'End Journey',
      `Mark your journey to "${activeJourney.destinationLabel}" as completed?`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'End Journey',
          onPress: async () => {
            setEnding(true);
            try {
              await endJourney();
              router.replace('/(app)/home');
            } catch {
              Alert.alert('Error', 'Could not end the journey. Please try again.');
            } finally {
              setEnding(false);
            }
          },
        },
      ],
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Journey',
      'Are you sure you want to cancel this journey?',
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'Cancel Journey',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await cancelJourney();
              router.replace('/(app)/home');
            } catch {
              Alert.alert('Error', 'Could not cancel the journey. Please try again.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerSide}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Active Journey</Text>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          <SOSButton onTrigger={handleSOSTrigger} variant="compact" />
        </View>
      </View>

      <LowBatteryBanner />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Status banner */}
        <View style={styles.statusBanner}>
          <Text style={styles.statusDot}>🟢</Text>
          <Text style={styles.statusLabel}>ACTIVE</Text>
          {isTracking && (
            <View style={styles.trackingBadge}>
              <Text style={styles.trackingBadgeText}>📡 Live</Text>
            </View>
          )}
        </View>

        {/* Check-in countdown card */}
        {phase === 'countdown' && (
          <View style={styles.checkInCard}>
            <Text style={styles.checkInIcon}>⏱</Text>
            <View style={styles.checkInBody}>
              <Text style={styles.checkInTitle}>Next check-in</Text>
              <Text style={styles.checkInTimer}>{formatMMSS(timeRemainingSeconds)}</Text>
            </View>
          </View>
        )}

        {/* Missed check-in indicator */}
        {phase === 'missed' && (
          <View style={styles.missedCard}>
            <Text style={styles.missedIcon}>⚠️</Text>
            <Text style={styles.missedText}>Check-in missed — journey ended.</Text>
          </View>
        )}

        {/* Map section */}
        <View style={styles.mapSection}>
          <Text style={styles.sectionLabel}>MAP</Text>
          <AppMapView
            region={mapData.region}
            markers={mapData.markers}
            polyline={mapData.polyline}
            style={styles.mapView}
          />
        </View>

        {/* Destination card */}
        <View style={styles.destinationCard}>
          <Text style={styles.destinationIcon}>📍</Text>
          <View style={styles.destinationBody}>
            <Text style={styles.destinationMeta}>Destination</Text>
            <Text style={styles.destinationLabel}>
              {activeJourney.destinationLabel}
            </Text>
          </View>
        </View>

        {/* Details card */}
        <View style={styles.detailCard}>
          <DetailRow
            label="Started"
            value={`${formatDate(activeJourney.startedAt)} at ${formatTime(activeJourney.startedAt)}`}
          />
          <View style={styles.divider} />
          <DetailRow
            label={isTracking ? 'Current location' : 'Start location'}
            value={formatCoordinates(currentLocation ?? activeJourney.startLocation)}
          />
          <View style={styles.divider} />
          <DetailRow
            label="ETA"
            value={routeLoading ? 'Calculating…' : routeError ? 'Unavailable' : formattedEta}
          />
          <View style={styles.divider} />
          <DetailRow
            label="Distance"
            value={routeLoading ? 'Calculating…' : routeError ? 'Unavailable' : formattedDistance}
          />
          <View style={styles.divider} />
          <DetailRow
            label="Travel time"
            value={routeLoading ? 'Calculating…' : routeError ? 'Unavailable' : formattedDuration}
          />
        </View>

        {/* Info note */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            🔔 Your trusted contacts will be notified when you end or cancel this journey.
          </Text>
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={styles.fakeCallButton}
          onPress={handleFakeCall}
          activeOpacity={0.8}
        >
          <Text style={styles.fakeCallButtonText}>📱  Fake Call</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.endButton, busy && styles.buttonBusy]}
          onPress={handleEnd}
          disabled={busy}
          activeOpacity={0.85}
        >
          {ending ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.endButtonText}>✅  I've arrived — End Journey</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cancelButton, busy && styles.buttonBusy]}
          onPress={handleCancel}
          disabled={busy}
          activeOpacity={0.8}
        >
          {cancelling ? (
            <ActivityIndicator color={COLORS.danger} />
          ) : (
            <Text style={styles.cancelButtonText}>✕  Cancel Journey</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      {/* Check-in prompt modal */}
      <Modal
        visible={phase === 'prompt'}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcon}>🔔</Text>
            <Text style={styles.modalTitle}>Are you safe?</Text>
            <Text style={styles.modalSubtitle}>
              Grace period: {formatMMSS(graceRemainingSeconds)} remaining
            </Text>

            <TouchableOpacity
              style={[styles.modalPrimaryBtn, (confirming || extendingMinutes !== null) && styles.modalBtnBusy]}
              onPress={handleConfirmSafe}
              disabled={confirming || extendingMinutes !== null}
              activeOpacity={0.85}
            >
              {confirming ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.modalPrimaryBtnText}>✅  I am safe</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.modalExtendLabel}>Extend timer</Text>
            <View style={styles.modalExtendRow}>
              {EXTEND_OPTIONS_MINUTES.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modalExtendBtn, (confirming || extendingMinutes !== null) && styles.modalBtnBusy]}
                  onPress={() => handleExtend(m)}
                  disabled={confirming || extendingMinutes !== null}
                  activeOpacity={0.75}
                >
                  {extendingMinutes === m ? (
                    <ActivityIndicator color={COLORS.primary} size="small" />
                  ) : (
                    <Text style={styles.modalExtendBtnText}>{m} min</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.modalDangerBtn, (confirming || extendingMinutes !== null) && styles.modalBtnBusy]}
              onPress={handleEnd}
              disabled={confirming || extendingMinutes !== null || busy}
              activeOpacity={0.8}
            >
              <Text style={styles.modalDangerBtnText}>End Journey</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  headerSide: {
    width: 64,
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  backText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  screenTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  container: {
    padding: 16,
    paddingBottom: 48,
  },
  // Empty state
  emptyScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  emptyDesc: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  homeButton: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  homeButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  // Status banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.successLight,
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.success + '40',
  },
  statusDot: {
    fontSize: 14,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.success,
    letterSpacing: 1,
  },
  trackingBadge: {
    marginLeft: 8,
    backgroundColor: COLORS.primary + '18',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  trackingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  // Destination card
  destinationCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  destinationIcon: {
    fontSize: 32,
  },
  destinationBody: {
    flex: 1,
  },
  destinationMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  destinationLabel: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -0.3,
  },
  // Detail card
  detailCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  detailLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  // Info note
  infoBox: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  infoText: {
    fontSize: 13,
    color: COLORS.primary,
    lineHeight: 19,
    fontWeight: '500',
  },
  // Buttons
  fakeCallButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  fakeCallButtonText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  endButton: {
    backgroundColor: COLORS.success,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  endButtonText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
  },
  cancelButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.danger + '60',
    backgroundColor: COLORS.dangerLight,
  },
  cancelButtonText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: '700',
  },
  buttonBusy: {
    opacity: 0.6,
  },
  // Map section
  mapSection: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginLeft: 2,
  },
  mapView: {
    minHeight: 160,
  },
  // Check-in countdown card
  checkInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warningLight,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.warning + '50',
    gap: 12,
  },
  checkInIcon: {
    fontSize: 24,
  },
  checkInBody: {
    flex: 1,
  },
  checkInTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.warning,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  checkInTimer: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  // Missed check-in card
  missedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerLight,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.danger + '40',
    gap: 10,
  },
  missedIcon: {
    fontSize: 20,
  },
  missedText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.danger,
    flex: 1,
  },
  // Check-in prompt modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  modalIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.danger,
    fontWeight: '600',
    marginBottom: 20,
  },
  modalPrimaryBtn: {
    width: '100%',
    backgroundColor: COLORS.success,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  modalPrimaryBtnText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
  },
  modalExtendLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  modalExtendRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginBottom: 16,
  },
  modalExtendBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primary + '60',
    backgroundColor: COLORS.primaryLight,
  },
  modalExtendBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  modalDangerBtn: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.danger + '50',
    backgroundColor: COLORS.dangerLight,
  },
  modalDangerBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.danger,
  },
  modalBtnBusy: {
    opacity: 0.5,
  },
});
