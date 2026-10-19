import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
import { GlassSurface } from '../glass';
import { Icon, type IconName } from '../ui/Icon';

interface RideBannerProps {
  icon: IconName;
  /** "Getting an auto" / "In an auto to NN2 8ET" — `rideHeadline`. */
  headline: string;
  /** `rideSubtitle`. */
  subtitle: string;
  /** Waiting for the ride (amber) or in it (accent). */
  waiting: boolean;
}

/**
 * The ride's status at the top of "On the way" (rides boards AP3 / AP4).
 * Wording comes from models/Ride.ts, which states only what WayLoc did or the
 * traveller said.
 */
export function RideBanner({ icon, headline, subtitle, waiting }: RideBannerProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const disc = waiting ? theme.warning.fg : theme.accent;

  return (
    <GlassSurface radius={RADIUS.lg} style={styles.banner}>
      <View
        style={[styles.disc, { backgroundColor: disc }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Icon name={icon} size={20} color={theme.textOnColor} />
      </View>
      <View style={styles.text} accessible accessibilityLabel={`${headline}. ${subtitle}`}>
        <Text style={styles.headline} numberOfLines={1}>
          {headline}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </GlassSurface>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
    },
    disc: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { flex: 1 },
    headline: {
      fontSize: 17,
      fontFamily: FONTS.headingXBold,
      color: theme.textPrimary,
    },
    subtitle: {
      fontSize: 13,
      lineHeight: 18,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
  });
}
