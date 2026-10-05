import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, SPACING, type ThemeColors } from '../../config/theme';
import { GlassPill } from '../glass';
import { Icon } from '../ui/Icon';

interface TurnBannerProps {
  /** Road currently being travelled. Null hides the banner entirely. */
  streetName: string | null;
  /** Pre-formatted remaining distance ("450 m"). Null when unknown. */
  remainingDistance: string | null;
}

/**
 * The glass banner at the top of "On the way" (Option 15 `AI4` §D).
 *
 * The spec draws this with a direction arrow. We render a road and a distance
 * instead, deliberately: `RouteStep` carries no manoeuvre or bearing data
 * because wayLoc is a safety app rather than a navigation one, so an arrow here
 * would be invented rather than derived — and §1 principle 4 forbids claiming
 * what we cannot know. A walking icon says "this is your route" without
 * implying guidance we are not giving.
 *
 * Renders nothing at all when there is no road to name, rather than a banner
 * with an empty slot in it.
 */
export function TurnBanner({ streetName, remainingDistance }: TurnBannerProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  if (!streetName) return null;

  return (
    <GlassPill style={styles.banner}>
      <Icon name="walk" size={20} color={theme.textPrimary} />
      <Text style={styles.street} numberOfLines={1}>
        {streetName}
      </Text>
      {remainingDistance && (
        <>
          <View style={styles.divider} />
          <Text style={styles.distance}>{remainingDistance}</Text>
        </>
      )}
    </GlassPill>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.lg,
    },
    street: {
      flexShrink: 1,
      fontSize: 16,
      fontFamily: FONTS.heading,
      color: theme.textPrimary,
    },
    divider: {
      width: StyleSheet.hairlineWidth,
      height: 18,
      backgroundColor: theme.border,
    },
    distance: {
      fontSize: 15,
      fontFamily: FONTS.body,
      color: theme.textSecondary,
    },
  });
}
