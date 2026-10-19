import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, SPACING, type ThemeColors } from '../../config/theme';
import { useTimeout } from '../../hooks/useTimeout';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { Icon, type IconName } from '../ui/Icon';
import { PICKUP_ALLOWANCE_MINUTES } from '../../models/TravelModeProfile';
import { RIDE_APP_NAMES, type RideApp } from '../../models/Ride';
import type { RideHandoffResult } from '../../services/RideHandoffService';

/** Long enough to read "Safe Journey started" before WayLoc leaves for the ride app. */
const OPEN_DELAY_MS = 1200;

interface RideHandoffSheetProps {
  app: RideApp;
  /** "getting an auto to 560001" — what the journey is now doing. */
  doing: string;
  /** "Mum & Alex" — family who see the ride. Null when nobody does. */
  watchers: string | null;
  open(): Promise<RideHandoffResult>;
  /** The app opened; the sheet goes. */
  onOpened(): void;
  /** The traveller gave up on the app; the journey keeps waiting without it. */
  onGiveUp(): void;
}

/**
 * "Safe Journey started — opening Uber" (rides board AP2). The journey is
 * already running when this shows (decision 1); then the ride app opens.
 *
 * A link that will not open leaves the journey running in `getting_ride` and
 * says so, with a retry — never a silent nothing, never a journey ended.
 *
 * "Mum & Alex can see you're getting an auto" names only family who see
 * journey details (`seesJourneyDetails`).
 */
export function RideHandoffSheet({ app, doing, watchers, open, onOpened, onGiveUp }: RideHandoffSheetProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const name = RIDE_APP_NAMES[app];
  const [state, setState] = useState<'opening' | 'failed'>('opening');

  const run = useCallback(async () => {
    setState('opening');
    const result = await open();
    if (result === 'opened') onOpened();
    else if (result !== 'busy') setState('failed');
  }, [open, onOpened]);

  // On arrival, and again on "Try again" (failed → opening re-arms it).
  useTimeout(() => void run(), state === 'opening' ? OPEN_DELAY_MS : null);

  return (
    <BottomSheet visible onDismiss={state === 'failed' ? onGiveUp : () => {}}>
      <View style={styles.content}>
        <View style={[styles.badge, { backgroundColor: state === 'failed' ? theme.warning.fg : theme.safe.fg }]}>
          <Icon name={state === 'failed' ? 'warning' : 'check'} size={32} color={theme.textOnColor} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {state === 'failed' ? `${name} didn't open` : 'Safe Journey started'}
        </Text>
        <Text style={styles.body}>
          {state === 'failed'
            ? `Your Safe Journey is still on, ${doing}. Try again, or book another way.`
            : `${watchers ? `${watchers} can see you're` : "You're"} ${doing}. Opening ${name} now…`}
        </Text>

        {state === 'opening' ? (
          <View style={styles.facts}>
            <Fact
              icon="time"
              tint={theme.warning.fg}
              title={`Pickup allowance: ${PICKUP_ALLOWANCE_MINUTES} min`}
              detail="No “late” check while you wait at the kerb"
              styles={styles}
            />
            <Fact
              icon="message"
              tint={theme.accent}
              title={`Only your destination goes to ${name}`}
              detail="Nothing about your circle or your safety"
              styles={styles}
            />
          </View>
        ) : (
          <View style={styles.actions}>
            <Button
              label="Try again"
              onPress={() => setState('opening')}
            />
            <Button label="I'll book another way" variant="secondary" onPress={onGiveUp} />
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

function Fact({
  icon,
  tint,
  title,
  detail,
  styles,
}: {
  icon: IconName;
  tint: string;
  title: string;
  detail: string;
  styles: ReturnType<typeof getStyles>;
}) {
  const theme = useTheme();
  return (
    <View style={styles.fact} accessible accessibilityLabel={`${title}. ${detail}`}>
      <View style={[styles.factIcon, { backgroundColor: tint }]}>
        <Icon name={icon} size={18} color={theme.textOnColor} />
      </View>
      <View style={styles.factText}>
        <Text style={styles.factTitle}>{title}</Text>
        <Text style={styles.factDetail}>{detail}</Text>
      </View>
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    content: { alignItems: 'center', gap: SPACING.md, paddingBottom: SPACING.lg },
    badge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 26, fontFamily: FONTS.headingXBold, color: theme.textPrimary, textAlign: 'center' },
    body: {
      fontSize: 16,
      lineHeight: 23,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    facts: { alignSelf: 'stretch', gap: SPACING.md, marginTop: SPACING.sm },
    fact: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    factIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    factText: { flex: 1 },
    factTitle: { fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    factDetail: { fontSize: 14, fontFamily: FONTS.body, color: theme.textSecondary },
    actions: { alignSelf: 'stretch', gap: SPACING.sm },
  });
}
