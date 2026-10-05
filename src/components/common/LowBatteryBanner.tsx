import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { SPACING, TYPOGRAPHY, type ThemeColors } from '../../config/theme';
import { useBatteryStatus } from '../../hooks/useBatteryStatus';
import { useLocationTrackingContext } from '../../context/LocationTrackingContext';
import { Icon } from '../ui/Icon';

export function LowBatteryBanner() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const { batteryPercent, isLowBattery } = useBatteryStatus();
  const { isTracking } = useLocationTrackingContext();

  if (!isLowBattery && !__DEV__) return null;

  return (
    <View style={[styles.container, isLowBattery ? styles.warning : styles.dev]}>
      {isLowBattery && (
        <View style={styles.warningRow}>
          <Icon name="battery" size={14} color={theme.warning.fg} />
          <Text style={styles.warningText}>
            Low battery ({batteryPercent}%) — location updates reduced to save power.
          </Text>
        </View>
      )}
      {__DEV__ && (
        <Text style={styles.devText}>
          {`[DEV] Battery ${batteryPercent}%${isLowBattery ? ' LOW' : ''}  Tracking ${isTracking ? '✓' : '✗'}`}
        </Text>
      )}
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
    },
    warning: {
      backgroundColor: theme.warning.bg,
      borderBottomWidth: 1,
      borderBottomColor: theme.warning.fg,
    },
    // The dev strip is informational, not a warning — it must not borrow the
    // amber that means "something needs your attention".
    dev: {
      backgroundColor: theme.surface,
    },
    warningRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs + 2,
    },
    warningText: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      fontWeight: '600',
      textAlign: 'center',
      color: theme.warning.fg,
    },
    devText: {
      fontSize: 11,
      color: theme.textSecondary,
      textAlign: 'center',
    },
  });
}
