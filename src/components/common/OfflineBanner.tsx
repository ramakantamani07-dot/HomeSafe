import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useOfflineSyncContext } from '../../context/OfflineSyncContext';
import { COLORS } from '../../config/constants';

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
    <View style={[styles.banner, isSyncingBanner ? styles.syncing : styles.offline]}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offline: {
    backgroundColor: COLORS.danger,
  },
  syncing: {
    backgroundColor: '#D97706', // amber-600
  },
  label: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
