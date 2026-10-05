import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, SPACING } from '../../config/theme';
import { Icon } from './Icon';

interface ScreenHeaderProps {
  title: string;
  /** Grey line under the title — "Mill Lane, SE15 4AB" on screen 04. */
  subtitle?: string;
  /** Teal action rendered inline after the subtitle ("· Change"). */
  subtitleAction?: { label: string; onPress(): void };
  onBack?: () => void;
  /** Lets a long destination name wrap onto a second line rather than truncate. */
  titleLines?: number;
}

/**
 * The plain back-chevron header used by every screen in the journey flow
 * except Home and On the way (screens 02–05, 10). Deliberately not a bordered
 * nav bar: the design puts the title directly on the page background with no
 * divider, and the chevron is a bare glyph rather than a "← Back" label.
 */
export function ScreenHeader({
  title,
  subtitle,
  subtitleAction,
  onBack,
  titleLines = 2,
}: ScreenHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Back"
            // The glyph itself is small; this widens the tappable area to the
            // 44pt minimum without pushing the title off its baseline.
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Icon name="chevronLeft" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
        )}
        <Text
          style={[styles.title, { color: theme.textPrimary }]}
          numberOfLines={titleLines}
        >
          {title}
        </Text>
      </View>

      {subtitle !== undefined && (
        <View style={styles.subtitleRow}>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
          {subtitleAction && (
            <>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}> · </Text>
              <TouchableOpacity
                onPress={subtitleAction.onPress}
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.subtitleAction, { color: theme.accent }]}>
                  {subtitleAction.label}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    gap: SPACING.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  backButton: {
    marginLeft: -SPACING.xs,
  },
  title: {
    flex: 1,
    fontSize: 28,
    lineHeight: 34,
    fontFamily: FONTS.headingXBold,
    letterSpacing: -0.5,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // Clears the chevron so the subtitle lines up under the title, not the
    // back button.
    paddingLeft: 36,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: FONTS.body,
  },
  subtitleAction: {
    fontSize: 15,
    fontFamily: FONTS.bodySemibold,
  },
});
