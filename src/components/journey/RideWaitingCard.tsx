import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
import { GlassSurface } from '../glass';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { RIDE_APP_NAMES, type RideApp, type RideBookedWith } from '../../models/Ride';

interface RideWaitingCardProps {
  /** "Are you in the auto now?" / "Still waiting for your auto?" — `rideQuestion`. */
  question: string;
  /** The app WayLoc opened, when it opened one — then "Yes" asks which app it was. */
  openedApp: RideApp | null;
  /** The address to copy for a ride app, never a nickname. Null hides Copy. */
  address: string | null;
  onConfirm(bookedWith: RideBookedWith | null): Promise<void>;
  onChangeTravel(): void;
  onCopyAddress(address: string): void;
}

/**
 * "Are you in the auto now?" (rides board AP3), shown while the journey is
 * `getting_ride`.
 *
 * The board says "Mum & Alex see 'getting an auto' until you say yes". Family
 * cannot see ride status until Phase 4 (rides.md), so this says only what is
 * true today: the Safe Journey is on while they wait.
 *
 * "Still waiting" (reopen the ride app) arrives with the provider hand-off in
 * Phase 3; with no app to reopen it would be a button that does nothing.
 */
export function RideWaitingCard({
  question,
  openedApp,
  address,
  onConfirm,
  onChangeTravel,
  onCopyAddress,
}: RideWaitingCardProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async (bookedWith: RideBookedWith | null) => {
    setBusy(true);
    try {
      await onConfirm(bookedWith);
    } finally {
      setBusy(false);
    }
  };

  // Opening Uber does not prove the ride is an Uber (rides.md, departure 3).
  if (asking && openedApp) {
    return (
      <GlassSurface variant="sheet" radius={RADIUS.xl} style={styles.card}>
        <Text style={styles.title}>Which did you book with?</Text>
        <View style={styles.row}>
          <View style={styles.half}>
            <Button label={RIDE_APP_NAMES[openedApp]} onPress={() => void confirm(openedApp)} loading={busy} />
          </View>
          <View style={styles.half}>
            <Button label="Other" variant="secondary" onPress={() => void confirm('other')} disabled={busy} />
          </View>
        </View>
      </GlassSurface>
    );
  }

  return (
    <GlassSurface variant="sheet" radius={RADIUS.xl} style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        {question}
      </Text>
      <Text style={styles.body}>Your Safe Journey is on while you wait.</Text>
      <Button
        label="Yes, I'm in"
        icon="check"
        onPress={() => (openedApp ? setAsking(true) : void confirm(null))}
        loading={busy}
      />
      <Button label="Change travel" variant="secondary" onPress={onChangeTravel} disabled={busy} />
      {address && (
        <TouchableOpacity
          onPress={() => onCopyAddress(address)}
          style={styles.copy}
          accessibilityRole="button"
          accessibilityLabel={`Copy the address for a ride app: ${address}`}
        >
          <Icon name="copy" size={16} color={theme.accent} />
          <Text style={styles.copyText} numberOfLines={1}>
            Copy address for a ride app
          </Text>
        </TouchableOpacity>
      )}
    </GlassSurface>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    card: {
      padding: SPACING.lg,
      gap: SPACING.md,
    },
    title: {
      fontSize: 22,
      fontFamily: FONTS.headingXBold,
      color: theme.textPrimary,
    },
    body: {
      fontSize: 15,
      lineHeight: 21,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
      marginTop: -SPACING.xs,
    },
    row: { flexDirection: 'row', gap: SPACING.sm },
    half: { flex: 1 },
    copy: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      minHeight: 44,
    },
    copyText: {
      fontSize: 15,
      fontFamily: FONTS.bodySemibold,
      color: theme.accent,
    },
  });
}
