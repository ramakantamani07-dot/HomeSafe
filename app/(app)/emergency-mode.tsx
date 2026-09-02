import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { COLORS } from '../../src/config/constants';
import { useSOS } from '../../src/hooks/useSOS';
import { formatCoordinates } from '../../src/models/Journey';

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function EmergencyModeScreen() {
  const router = useRouter();
  const { activeSOS, isSOSLoading, resolveSOS } = useSOS();
  const [resolving, setResolving] = useState(false);

  // If there is no active SOS (already resolved, or navigated here incorrectly), go home.
  useEffect(() => {
    if (!isSOSLoading && !activeSOS) {
      router.replace('/(app)/home');
    }
  }, [activeSOS, isSOSLoading, router]);

  if (isSOSLoading || !activeSOS) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color={COLORS.danger} />
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
            setResolving(true);
            try {
              await resolveSOS();
              // Navigation is driven by the useEffect that watches activeSOS → null.
            } catch {
              Alert.alert('Error', 'Could not resolve the SOS. Please try again.');
            } finally {
              setResolving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Emergency header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚠️  EMERGENCY MODE</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* SOS badge */}
        <View style={styles.sosBadge}>
          <Text style={styles.sosLabel}>SOS</Text>
          <Text style={styles.sosSubLabel}>Alert Active</Text>
        </View>

        {/* Details card */}
        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Triggered</Text>
            <Text style={styles.detailValue}>
              {formatDate(activeSOS.triggeredAt)} at {formatTime(activeSOS.triggeredAt)}
            </Text>
          </View>

          {activeSOS.journeyId && (
            <>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Journey</Text>
                <Text style={styles.detailValue}>Active when triggered</Text>
              </View>
            </>
          )}

          {activeSOS.location && (
            <>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Last location</Text>
                <Text style={styles.detailValue}>
                  {formatCoordinates(activeSOS.location)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Notice */}
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            🔔 Your trusted contacts will be notified of this alert.
            {'\n\n'}
            If you are in danger, please contact emergency services directly.
          </Text>
        </View>

        {/* Resolve button */}
        <TouchableOpacity
          style={[styles.resolveButton, resolving && styles.buttonBusy]}
          onPress={handleResolve}
          disabled={resolving}
          activeOpacity={0.85}
        >
          {resolving ? (
            <ActivityIndicator color={COLORS.danger} />
          ) : (
            <Text style={styles.resolveButtonText}>✅  I am safe — Resolve SOS</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.dangerLight,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    backgroundColor: COLORS.danger,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 1,
  },
  container: {
    padding: 24,
    paddingBottom: 48,
    alignItems: 'center',
  },
  sosBadge: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 28,
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 5,
    borderColor: COLORS.dangerDark,
  },
  sosLabel: {
    fontSize: 44,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 3,
  },
  sosSubLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1,
    marginTop: 2,
  },
  detailCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.danger + '30',
    paddingHorizontal: 16,
    marginBottom: 16,
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
  noticeBox: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: COLORS.danger + '30',
  },
  noticeText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 21,
  },
  resolveButton: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.danger,
    backgroundColor: COLORS.surface,
  },
  resolveButtonText: {
    color: COLORS.danger,
    fontSize: 17,
    fontWeight: '700',
  },
  buttonBusy: {
    opacity: 0.6,
  },
});
