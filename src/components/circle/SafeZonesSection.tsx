import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
import { canAddZone, describeZone, type SafeZone } from '../../models/SafeZone';
import { Icon } from '../ui/Icon';
import { describeRadius } from './findCopy';

interface SafeZonesSectionProps {
  name: string;
  zones: SafeZone[];
  /** Whether consent is ACTIVE — zones exist either way, but are only checked then. */
  checking: boolean;
  now: Date;
  onAdd(): void;
  onDelete(zone: SafeZone): void;
}

/**
 * A basic-phone member's safe zones (Phase 6.5, spec §11 item 4).
 *
 * Each zone says what the network last answered and when. While consent is
 * not ACTIVE nothing is checked, and the section says so rather than leaving
 * stale states looking current.
 */
export function SafeZonesSection({ name, zones, checking, now, onAdd, onDelete }: SafeZonesSectionProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  const confirmDelete = (zone: SafeZone) =>
    Alert.alert(`Remove ${zone.name}?`, `You won't be told when ${name} arrives or leaves.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onDelete(zone) },
    ]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>SAFE ZONES</Text>
      <View style={styles.card}>
        {zones.map((zone, i) => (
          <View key={zone.id} style={[styles.row, i > 0 && styles.divider]}>
            <View style={[styles.dot, zone.state === 'inside' ? styles.dotInside : styles.dotOther]} />
            <View style={styles.text}>
              <Text style={styles.title}>
                {zone.name} <Text style={styles.radius}>· {describeRadius(zone.radiusMeters)}</Text>
              </Text>
              <Text style={styles.detail}>{checking ? describeZone(zone, now) : 'Not checked while sharing is off'}</Text>
            </View>
            <TouchableOpacity
              onPress={() => confirmDelete(zone)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${zone.name}`}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="close" size={18} color={theme.textTertiary} />
            </TouchableOpacity>
          </View>
        ))}
        {canAddZone(zones.length) && (
          <TouchableOpacity style={[styles.row, zones.length > 0 && styles.divider]} onPress={onAdd} accessibilityRole="button">
            <Icon name="add" size={18} color={theme.accent} />
            <Text style={styles.add}>Add a safe zone</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.note}>
        You're told when {name} arrives or leaves — checked about every 15 minutes from their network, so
        allow up to half an hour. {name} is texted once when a zone is added.
      </Text>
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    wrap: { gap: SPACING.sm },
    label: { fontSize: 12, fontFamily: FONTS.bodySemibold, letterSpacing: 0.6, color: theme.textSecondary },
    card: { borderRadius: RADIUS.lg, backgroundColor: theme.surface, paddingHorizontal: SPACING.lg },
    row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, minHeight: 56, paddingVertical: SPACING.sm },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
    dot: { width: 10, height: 10, borderRadius: 5 },
    dotInside: { backgroundColor: theme.safe.fg },
    dotOther: { backgroundColor: theme.border },
    text: { flex: 1 },
    title: { fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    radius: { fontFamily: FONTS.body, color: theme.textSecondary },
    detail: { fontSize: 13, fontFamily: FONTS.body, color: theme.textSecondary },
    add: { fontSize: 15, fontFamily: FONTS.bodySemibold, color: theme.accent },
    note: { fontSize: 13, lineHeight: 18, fontFamily: FONTS.body, color: theme.textSecondary },
  });
}
