import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../../config/constants';
import { formatCoordinates } from '../../models/Journey';
import type { MarkerRole } from '../../models/MapModels';
import type { AppMapViewProps, MapProvider } from '../../providers/MapProvider';

const ROLE_COLOR: Record<MarkerRole, string> = {
  start: COLORS.primary,
  current: COLORS.success,
  destination: COLORS.danger,
};

const ROLE_LABEL: Record<MarkerRole, string> = {
  start: 'Start',
  current: 'You are here',
  destination: 'Destination',
};

function MockMapView({ region, markers, polyline, style }: AppMapViewProps) {
  return (
    <View style={[styles.container, style]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🗺️  Map View</Text>
        <View style={styles.devBadge}>
          <Text style={styles.devBadgeText}>DEV</Text>
        </View>
      </View>

      {/* Markers */}
      <View style={styles.body}>
        {markers.length === 0 ? (
          <Text style={styles.emptyText}>No markers</Text>
        ) : (
          markers.map((m) => (
            <View key={m.id} style={styles.markerRow}>
              <View style={[styles.dot, { backgroundColor: ROLE_COLOR[m.role] }]} />
              <View style={styles.markerBody}>
                <Text style={styles.markerRole}>{ROLE_LABEL[m.role]}</Text>
                <Text style={styles.markerTitle}>{m.title}</Text>
                <Text style={styles.markerCoords}>
                  {formatCoordinates(m.coordinate)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Route footer */}
      <View style={styles.footer}>
        {polyline ? (
          <Text style={styles.footerText}>
            Route: {polyline.coordinates.length} waypoints
          </Text>
        ) : (
          <Text style={[styles.footerText, styles.footerMuted]}>
            Route: — (no destination coordinates)
          </Text>
        )}
      </View>
    </View>
  );
}

export class MockMapProvider implements MapProvider {
  MapView = MockMapView;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.primaryLight,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  devBadge: {
    backgroundColor: COLORS.warning,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  devBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  body: {
    padding: 14,
    gap: 12,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  markerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    flexShrink: 0,
    marginTop: 2,
  },
  markerBody: {
    flex: 1,
  },
  markerRole: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  markerTitle: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '600',
    marginBottom: 1,
  },
  markerCoords: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '400',
  },
  footer: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  footerMuted: {
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
});
