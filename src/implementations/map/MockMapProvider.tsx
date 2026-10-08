import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { formatCoordinates } from '../../models/Journey';
import type { MarkerRole } from '../../models/MapModels';
import type { AppMapViewProps, MapProvider } from '../../providers/MapProvider';

function roleColors(theme: ReturnType<typeof useTheme>): Record<MarkerRole, string> {
  return {
    start: theme.accent,
    current: theme.safe.fg,
    destination: theme.critical.fg,
  };
}

const ROLE_LABEL: Record<MarkerRole, string> = {
  start: 'Start',
  current: 'You are here',
  destination: 'Destination',
};

function MockMapView({ region, markers, polyline, areas = [], style }: AppMapViewProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const ROLE_COLOR = roleColors(theme);

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

      {areas.map((a) => (
        <View key={a.id} style={styles.markerRow}>
          <View style={[styles.dot, { backgroundColor: theme.accent }]} />
          <View style={styles.markerBody}>
            <Text style={styles.markerRole}>Approximate area</Text>
            <Text style={styles.markerTitle}>Within {a.radiusMeters} m</Text>
            <Text style={styles.markerCoords}>{formatCoordinates(a.centre)}</Text>
          </View>
        </View>
      ))}

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

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
  container: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.accentMuted,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.accent,
  },
  devBadge: {
    backgroundColor: theme.warning.fg,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  devBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.textOnColor,
    letterSpacing: 0.5,
  },
  body: {
    padding: 14,
    gap: 12,
  },
  emptyText: {
    fontSize: 13,
    color: theme.textTertiary,
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
    color: theme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  markerTitle: {
    fontSize: 13,
    color: theme.textPrimary,
    fontWeight: '600',
    marginBottom: 1,
  },
  markerCoords: {
    fontSize: 11,
    color: theme.textTertiary,
    fontWeight: '400',
  },
  footer: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.background,
  },
  footerText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  footerMuted: {
    color: theme.textTertiary,
    fontStyle: 'italic',
  },
  });
}
