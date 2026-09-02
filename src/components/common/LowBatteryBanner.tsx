import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../../config/constants';
import { useBatteryStatus } from '../../hooks/useBatteryStatus';
import { useLocationTrackingContext } from '../../context/LocationTrackingContext';

export function LowBatteryBanner() {
  const { batteryLevel, isLowBattery } = useBatteryStatus();
  const { isTracking } = useLocationTrackingContext();

  const pct = Math.round(batteryLevel * 100);

  if (!isLowBattery && !__DEV__) return null;

  return (
    <View style={[styles.container, isLowBattery ? styles.warning : styles.dev]}>
      {isLowBattery && (
        <Text style={styles.warningText}>
          🔋 Low battery ({pct}%) — location updates reduced to save power.
        </Text>
      )}
      {__DEV__ && (
        <Text style={styles.devText}>
          {`[DEV] Battery ${pct}%${isLowBattery ? ' ⚠ LOW' : ''}  Tracking ${isTracking ? '✓' : '✗'}`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  warning: {
    backgroundColor: COLORS.warningLight,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.warning + '40',
  },
  dev: {
    backgroundColor: '#1a1a2e',
  },
  warningText: {
    fontSize: 13,
    color: COLORS.warning,
    fontWeight: '600',
    textAlign: 'center',
  },
  devText: {
    fontSize: 11,
    color: '#7fdbff',
    textAlign: 'center',
  },
});
