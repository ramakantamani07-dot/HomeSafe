import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useOfflineSyncContext } from '../../context/OfflineSyncContext';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, TYPOGRAPHY } from '../../config/theme';

/**
 * Displays a coloured banner at the top of any screen when the device is
 * offline or while queued operations are being synced after reconnection.
 *
 * Usage: place inside the screen layout, below any safe-area inset:
 *   <SafeAreaView>
 *     <OfflineBanner />
 *     {…screen content…}
 *   </SafeAreaView>
 */
export function OfflineBanner() {
  const theme = useTheme();
  const { isOffline } = useNetworkStatus();
  const { pendingCount, isSyncing } = useOfflineSyncContext();

  if (!isOffline && !isSyncing) return null;

  const isSyncingBanner = !isOffline && isSyncing;
  const label = isSyncingBanner
    ? `Syncing ${pendingCount} queued action${pendingCount !== 1 ? 's' : ''}…`
    : pendingCount > 0
      ? `No internet — ${pendingCount} action${pendingCount !== 1 ? 's' : ''} queued`
      : 'No internet connection';

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: isSyncingBanner ? theme.warning.fg : theme.critical.fg },
      ]}
    >
      <Text style={[styles.label, { color: theme.textOnColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: SPACING.sm - 1,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: TYPOGRAPHY.callout.fontSize,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
