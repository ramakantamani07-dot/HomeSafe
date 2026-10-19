import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
import { GlassSurface } from '../glass';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { VEHICLE_NUMBER_MAX_CHARS, normaliseVehicleNumber } from '../../models/Ride';

interface VehicleNumberRowProps {
  vehicleNumber: string | null;
  /** "Mum & Alex" — family who see the ride. Null when nobody does. */
  watchers: string | null;
  /** Saves (or, with '', removes) the number. Throws when it could not be saved. */
  onSave(input: string): Promise<void>;
}

/**
 * "Add vehicle number (optional)" (rides board AP4), once the traveller is in
 * the ride.
 *
 * "Shared only with Mum & Alex" names the family who see journey details;
 * with nobody, it is kept with the journey only, and the row says that.
 */
export function VehicleNumberRow({ vehicleNumber, watchers, onSave }: VehicleNumberRowProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const open = () => {
    setDraft(vehicleNumber ?? '');
    setEditing(true);
  };

  const save = async (input: string) => {
    setSaving(true);
    try {
      await onSave(input);
      setEditing(false);
    } catch {
      Alert.alert("Couldn't save", 'Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  // Spaces are kept for reading; the limit counts letters and digits.
  const preview = normaliseVehicleNumber(draft);

  return (
    <>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={
          vehicleNumber ? `Vehicle number ${vehicleNumber}. Change it.` : 'Add vehicle number, optional'
        }
      >
        <GlassSurface radius={RADIUS.lg} style={styles.row}>
          <View style={[styles.disc, { backgroundColor: theme.travelling.fg }]}>
            <Icon name="car" size={18} color={theme.textOnColor} />
          </View>
          <View style={styles.text}>
            <Text style={styles.title} numberOfLines={1}>
              {vehicleNumber ?? 'Add vehicle number (optional)'}
            </Text>
            <Text style={styles.note} numberOfLines={1}>
              {watchers ? `Shared only with ${watchers}` : 'Kept with this journey · deleted with its trail'}
            </Text>
          </View>
          <Icon name="chevronRight" size={18} color={theme.textTertiary} />
        </GlassSurface>
      </Pressable>

      <BottomSheet visible={editing} onDismiss={() => setEditing(false)}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Vehicle number</Text>
          <Text style={styles.sheetBody}>
            {watchers
              ? `As it is on the number plate. Shared only with ${watchers}, and deleted with the journey's trail.`
              : 'As it is on the number plate. Kept with this journey and deleted with its trail.'}
          </Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="MH 12 AB 1234"
            placeholderTextColor={theme.textTertiary}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            maxLength={VEHICLE_NUMBER_MAX_CHARS + 6}
            returnKeyType="done"
            onSubmitEditing={() => void save(draft)}
            style={styles.input}
            accessibilityLabel="Vehicle number"
          />
          <Button
            label="Save"
            onPress={() => void save(draft)}
            loading={saving}
            disabled={!preview || preview === vehicleNumber}
          />
          {vehicleNumber && (
            <Button label="Remove" variant="ghost" onPress={() => void save('')} disabled={saving} />
          )}
        </View>
      </BottomSheet>
    </>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      minHeight: 56,
    },
    disc: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { flex: 1 },
    title: {
      fontSize: 16,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
    note: {
      fontSize: 13,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    sheet: { gap: SPACING.md, paddingBottom: SPACING.md },
    sheetTitle: {
      fontSize: 22,
      fontFamily: FONTS.headingXBold,
      color: theme.textPrimary,
    },
    sheetBody: {
      fontSize: 15,
      lineHeight: 21,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
    input: {
      minHeight: 52,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      paddingHorizontal: SPACING.md,
      fontSize: 20,
      letterSpacing: 1,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
      backgroundColor: theme.surfaceRaised,
    },
  });
}
