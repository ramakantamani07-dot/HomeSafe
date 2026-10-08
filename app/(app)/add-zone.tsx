import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../src/config/theme';
import { useBasicPhoneMember, useBasicPhoneMembers } from '../../src/hooks/useBasicPhoneMembers';
import { usePlaces } from '../../src/hooks/usePlaces';
import { useGoBack } from '../../src/hooks/useGoBack';
import { ZONE_RADIUS_CHOICES } from '../../src/models/SafeZone';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Button } from '../../src/components/ui/Button';
import { Icon } from '../../src/components/ui/Icon';
import { describeRadius } from '../../src/components/circle/findCopy';

/**
 * Add a safe zone (Phase 6.5).
 *
 * Built from the guardian's saved places — Home, School, wherever they have
 * already set an address — because those are the places that matter, and
 * picking one is faster and less error-prone than dropping a pin. The radius
 * starts at the smallest the network can honestly answer for.
 */
export default function AddZoneScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const goBack = useGoBack();
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const member = useBasicPhoneMember(memberId);
  const { addZone } = useBasicPhoneMembers();
  const { savedPlaces } = usePlaces();

  const usable = savedPlaces.filter((p) => p.place !== null);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [radius, setRadius] = useState<number>(ZONE_RADIUS_CHOICES[0]);
  const [saving, setSaving] = useState(false);

  const chosen = usable.find((p) => p.id === placeId) ?? null;
  const ready = chosen !== null && name.trim().length > 0;

  const save = async () => {
    if (!chosen?.place || !member) return;
    setSaving(true);
    try {
      await addZone({ memberId: member.id, name: name.trim(), centre: chosen.place.coordinates, radiusMeters: radius });
      goBack();
    } catch {
      Alert.alert("Couldn't add the zone", 'Check your connection and try again.');
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader title="Add a safe zone" onBack={goBack} />

        <Text style={styles.label}>Where</Text>
        {usable.length === 0 ? (
          <Text style={styles.muted}>Save a place with an address first — Settings → Saved places.</Text>
        ) : (
          <View style={styles.card}>
            {usable.map((p, i) => {
              const selected = p.id === placeId;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.row, i > 0 && styles.divider]}
                  onPress={() => {
                    setPlaceId(p.id);
                    setName(p.name);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <View style={styles.flex}>
                    <Text style={styles.title}>{p.name}</Text>
                    <Text style={styles.muted} numberOfLines={1}>{p.place?.formattedAddress}</Text>
                  </View>
                  {selected && <Icon name="check" size={18} color={theme.accent} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {chosen && (
          <>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              maxLength={40}
              accessibilityLabel="Zone name"
            />

            <Text style={styles.label}>How big</Text>
            <View style={styles.chips}>
              {ZONE_RADIUS_CHOICES.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.chip, r === radius && styles.chipOn]}
                  onPress={() => setRadius(r)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: r === radius }}
                >
                  <Text style={[styles.chipText, r === radius && styles.chipTextOn]}>
                    {describeRadius(r).replace('within ', '')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.muted}>
              Network location is approximate, so zones start at {describeRadius(ZONE_RADIUS_CHOICES[0]).replace('within ', '')}.
              {member ? ` ${member.displayName} will be texted once to say this zone exists.` : ''}
            </Text>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Add zone" variant="primary" onPress={save} disabled={!ready} loading={saving} />
      </View>
    </SafeAreaView>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    flex: { flex: 1 },
    container: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
    label: { fontSize: 13, fontFamily: FONTS.bodySemibold, color: theme.textSecondary, marginTop: SPACING.xs },
    card: { borderRadius: RADIUS.lg, backgroundColor: theme.surface, paddingHorizontal: SPACING.lg },
    row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, minHeight: 56, paddingVertical: SPACING.sm },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
    title: { fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    muted: { fontSize: 13, lineHeight: 18, fontFamily: FONTS.body, color: theme.textSecondary },
    input: {
      padding: SPACING.md,
      borderRadius: RADIUS.lg,
      backgroundColor: theme.surface,
      fontSize: 16,
      fontFamily: FONTS.bodySemibold,
      color: theme.textPrimary,
    },
    chips: { flexDirection: 'row', gap: SPACING.sm },
    chip: {
      minHeight: 40,
      paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.pill,
      justifyContent: 'center',
      backgroundColor: theme.surface,
    },
    chipOn: { backgroundColor: theme.accent },
    chipText: { fontSize: 15, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    chipTextOn: { color: theme.textOnColor },
    footer: { padding: SPACING.lg },
  });
}
