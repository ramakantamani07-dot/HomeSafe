import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { COLORS } from '../../src/config/constants';
import { CHECK_IN_INTERVAL_OPTIONS } from '../../src/models/CheckIn';
import { useJourney } from '../../src/hooks/useJourney';
import type { Coordinates } from '../../src/models/Journey';

const MAX_LABEL_LENGTH = 100;
const INTERVAL_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: 'None', value: null },
  ...CHECK_IN_INTERVAL_OPTIONS.map((m) => ({ label: `${m} min`, value: m })),
];

function parseCoord(raw: string): number | null {
  const n = parseFloat(raw.trim());
  return isNaN(n) ? null : n;
}

export default function StartJourneyScreen() {
  const router = useRouter();
  const { startJourney } = useJourney();

  const [destination, setDestination] = useState('');
  const [checkInIntervalMinutes, setCheckInIntervalMinutes] = useState<number | null>(null);
  const [destLat, setDestLat] = useState('');
  const [destLng, setDestLng] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setError(null);

    // Parse destination coordinates — both must be valid numbers or both empty
    const lat = parseCoord(destLat);
    const lng = parseCoord(destLng);
    const hasLat = destLat.trim() !== '';
    const hasLng = destLng.trim() !== '';

    if ((hasLat && lat === null) || (hasLng && lng === null)) {
      setError('Destination coordinates must be valid numbers (e.g. 51.5074, -0.1278).');
      return;
    }
    if (hasLat !== hasLng) {
      setError('Enter both latitude and longitude, or leave both empty.');
      return;
    }
    if (lat !== null && (lat < -90 || lat > 90)) {
      setError('Latitude must be between -90 and 90.');
      return;
    }
    if (lng !== null && (lng < -180 || lng > 180)) {
      setError('Longitude must be between -180 and 180.');
      return;
    }

    const destinationCoordinates: Coordinates | null =
      lat !== null && lng !== null ? { latitude: lat, longitude: lng } : null;

    setStarting(true);
    try {
      await startJourney(destination, checkInIntervalMinutes, destinationCoordinates);
      router.replace('/(app)/active-journey');
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not start journey. Please try again.',
      );
    } finally {
      setStarting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerSide}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Start Journey</Text>
          <View style={styles.headerSide} />
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.icon}>🗺️</Text>
          <Text style={styles.heading}>Where are you heading?</Text>
          <Text style={styles.subheading}>
            Give your destination a name your trusted contacts will recognise.
          </Text>

          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>Destination</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Home, Office, Sarah's place"
              placeholderTextColor={COLORS.textMuted}
              value={destination}
              onChangeText={(t) => {
                setDestination(t);
                if (error) setError(null);
              }}
              maxLength={MAX_LABEL_LENGTH}
              returnKeyType="done"
              onSubmitEditing={handleStart}
              editable={!starting}
              autoFocus
              autoCapitalize="sentences"
            />
            <Text style={styles.charCount}>
              {destination.length}/{MAX_LABEL_LENGTH}
            </Text>
          </View>

          {/* Check-in interval picker */}
          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>Check-in reminder</Text>
            <Text style={styles.intervalHint}>
              HomeSafe will prompt you to confirm you're safe at this interval.
            </Text>
            <View style={styles.chipRow}>
              {INTERVAL_OPTIONS.map((opt) => {
                const selected = checkInIntervalMinutes === opt.value;
                return (
                  <TouchableOpacity
                    key={String(opt.value)}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setCheckInIntervalMinutes(opt.value)}
                    disabled={starting}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Destination coordinates (optional) */}
          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>Destination Coordinates (optional)</Text>
            <Text style={styles.intervalHint}>
              Provide latitude and longitude to get a route and ETA on the map.
            </Text>
            <View style={styles.coordRow}>
              <View style={styles.coordField}>
                <Text style={styles.coordFieldLabel}>Latitude</Text>
                <TextInput
                  style={styles.coordInput}
                  placeholder="e.g. 51.5074"
                  placeholderTextColor={COLORS.textMuted}
                  value={destLat}
                  onChangeText={(t) => { setDestLat(t); if (error) setError(null); }}
                  keyboardType="numeric"
                  editable={!starting}
                  returnKeyType="next"
                />
              </View>
              <View style={styles.coordField}>
                <Text style={styles.coordFieldLabel}>Longitude</Text>
                <TextInput
                  style={styles.coordInput}
                  placeholder="e.g. -0.1278"
                  placeholderTextColor={COLORS.textMuted}
                  value={destLng}
                  onChangeText={(t) => { setDestLng(t); if (error) setError(null); }}
                  keyboardType="numeric"
                  editable={!starting}
                  returnKeyType="done"
                  onSubmitEditing={handleStart}
                />
              </View>
            </View>
          </View>

          {error !== null && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.startButton, starting && styles.startButtonBusy]}
            onPress={handleStart}
            disabled={starting}
            activeOpacity={0.85}
          >
            {starting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.startButtonText}>📍  Get Location & Start</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.hint}>
            HomeSafe captures your current location when the journey starts and
            tracks your position while the journey is active.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
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
    padding: 24,
    paddingBottom: 48,
    alignItems: 'center',
  },
  icon: {
    fontSize: 64,
    marginTop: 16,
    marginBottom: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  inputCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    fontSize: 17,
    color: COLORS.textPrimary,
    paddingVertical: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
    marginBottom: 6,
  },
  charCount: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'right',
  },
  intervalHint: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  chipTextSelected: {
    color: COLORS.white,
  },
  coordRow: {
    flexDirection: 'row',
    gap: 12,
  },
  coordField: {
    flex: 1,
  },
  coordFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  coordInput: {
    fontSize: 15,
    color: COLORS.textPrimary,
    paddingVertical: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
  },
  errorBox: {
    width: '100%',
    backgroundColor: COLORS.dangerLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.danger + '40',
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.danger,
    lineHeight: 20,
  },
  startButton: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonBusy: {
    backgroundColor: COLORS.textMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
  startButtonText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  hint: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
