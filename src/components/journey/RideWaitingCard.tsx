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
  /** "an auto", "a cab" — `rideNoun`. */
  noun: string;
  /** The app WayLoc opened, when it opened one — then "Yes" asks which app it was. */
  openedApp: RideApp | null;
  /** The address to copy for a ride app, never a nickname. Null hides Copy. */
  address: string | null;
  /** "Mum & Alex" — family who see the ride (`seesJourneyDetails`). Null when nobody does. */
  watchers: string | null;
  onConfirm(bookedWith: RideBookedWith | null): Promise<void>;
  onChangeTravel(): void;
  /** "Still waiting ↗": back to the ride app WayLoc opened. Only when it opened one. */
  onReopenApp(app: RideApp): void;
  onCopyAddress(address: string): void;
}

/**
 * "Are you in the auto now?" (rides board AP3), shown while the journey is
 * `getting_ride`.
 *
 * "Mum & Alex see 'getting an auto' until you say yes" names only the family
 * who do see journey details; with nobody, it says only that the Safe Journey
 * is on.
 *
 * "Still waiting ↗" reopens the ride app WayLoc opened; with no app opened
 * ("I'll sort it myself") there is nothing to reopen, so it is not shown.
 */
export function RideWaitingCard({
  question,
  noun,
  openedApp,
  address,
  watchers,
  onConfirm,
  onChangeTravel,
  onReopenApp,
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
      <Text style={styles.body}>
        {watchers
          ? `${watchers} see “getting ${noun}” until you say yes.`
          : 'Your Safe Journey is on while you wait.'}
      </Text>
      <Button
        label="Yes, I'm in"
        icon="check"
        onPress={() => (openedApp ? setAsking(true) : void confirm(null))}
        loading={busy}
      />
      <View style={styles.row}>
        {openedApp && (
          <View style={styles.half}>
            <Button
              label="Still waiting"
              icon="link"
              variant="secondary"
              onPress={() => onReopenApp(openedApp)}
              disabled={busy}
              accessibilityHint={`Opens ${RIDE_APP_NAMES[openedApp]} again`}
            />
          </View>
        )}
        <View style={styles.half}>
          <Button label="Change travel" variant="secondary" onPress={onChangeTravel} disabled={busy} />
        </View>
      </View>
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
