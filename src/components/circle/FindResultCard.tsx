import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FEATURE_COLORS, FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
import type { FindState } from '../../context/BasicPhoneContext';
import type { MapArea } from '../../models/MapModels';
import { Icon, type IconName } from '../ui/Icon';
import { describeFindFailure, describeRadius, formatFindTime, minutesUntil } from './findCopy';

interface FindResultCardProps {
  name: string;
  state: FindState | undefined;
  /** The area on the map — this find's, or the last known one when unreachable. */
  area: MapArea | null;
  /** When that area was observed. */
  seenAt: Date | null;
  /** Null when Find is allowed now. */
  nextFindAt: Date | null;
  now: Date;
  onCall(): void;
  onText(): void;
  onDirections(): void;
  onFindAgain(): void;
  onHistory(): void;
}

/**
 * The sheet under the find-result map (Option 15 AI13), in every state the
 * spec names: asking the network, found, and each way it can fail.
 *
 * Found reads "is in this area", never "is here": the circle is the answer,
 * and the copy says so twice — "From … network, not GPS" — because a guardian
 * glancing at a pin-like centre would otherwise take it as a position.
 */
export function FindResultCard(props: FindResultCardProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const { name, state, area, seenAt, nextFindAt, now } = props;

  const headline = (() => {
    if (state?.status === 'finding') return { title: `Asking ${name}'s network…`, body: null };
    if (state?.status === 'failed') return describeFindFailure(state.failure, name);
    if (area) return { title: `${name} is in this area`, body: null };
    return { title: `Find ${name}`, body: 'See the approximate area their mobile network places them in.' };
  })();

  const showLastKnown = state?.status === 'failed' && area !== null;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{headline.title}</Text>
        {state?.status === 'finding' && <ActivityIndicator color={theme.accent} />}
      </View>

      {seenAt && area && state?.status !== 'finding' && (
        <View style={styles.seenChip}>
          <Text style={styles.seenText}>
            {showLastKnown ? 'Last known' : 'Last seen'} {formatFindTime(seenAt, now)}
          </Text>
        </View>
      )}

      {headline.body && <Text style={styles.body}>{headline.body}</Text>}

      <View style={styles.actions}>
        <Action icon="call" label={`Call ${name}`} onPress={props.onCall} styles={styles} theme={theme} />
        <Action icon="message" label="Text" onPress={props.onText} styles={styles} theme={theme} />
        {area && (
          <Action icon="navigate" label="Go there" onPress={props.onDirections} styles={styles} theme={theme} />
        )}
      </View>

      {area && state?.status !== 'finding' && (
        <View style={styles.note}>
          <Text style={styles.noteText}>
            From {name}'s mobile network, not GPS — they're somewhere inside the circle (
            {describeRadius(area.radiusMeters)}). {name} is texted when you look, at most once an hour.
          </Text>
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.findAgain, (nextFindAt || state?.status === 'finding') && styles.disabled]}
          disabled={nextFindAt !== null || state?.status === 'finding'}
          onPress={props.onFindAgain}
          accessibilityRole="button"
        >
          <Text style={[styles.findAgainText, nextFindAt && styles.disabledText]}>
            {nextFindAt
              ? `Find again in ${minutesUntil(nextFindAt, now)} min`
              : state ? 'Find again' : `Find ${name}`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.history} onPress={props.onHistory} accessibilityRole="button">
          <Text style={styles.historyText}>History</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Action({
  icon,
  label,
  onPress,
  styles,
  theme,
}: {
  icon: IconName;
  label: string;
  onPress(): void;
  styles: ReturnType<typeof getStyles>;
  theme: ThemeColors;
}) {
  return (
    <TouchableOpacity style={styles.action} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Icon name={icon} size={18} color={theme.accent} />
      <Text style={styles.actionText} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    card: {
      padding: SPACING.lg,
      gap: SPACING.md,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      backgroundColor: theme.surface,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    title: { flex: 1, fontSize: 22, fontFamily: FONTS.headingXBold, color: theme.textPrimary },
    seenChip: {
      alignSelf: 'flex-start',
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.pill,
      backgroundColor: FEATURE_COLORS.basicPhoneArea,
    },
    seenText: { fontSize: 13, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    body: { fontSize: 15, lineHeight: 21, fontFamily: FONTS.body, color: theme.textSecondary },
    actions: { flexDirection: 'row', gap: SPACING.sm },
    action: {
      flex: 1,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      borderRadius: RADIUS.pill,
      backgroundColor: theme.accentMuted,
    },
    actionText: { fontSize: 15, fontFamily: FONTS.bodySemibold, color: theme.accent },
    note: { padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: theme.background },
    noteText: { fontSize: 14, lineHeight: 20, fontFamily: FONTS.body, color: theme.textSecondary },
    footer: { flexDirection: 'row', gap: SPACING.sm },
    findAgain: {
      flex: 1,
      minHeight: 48,
      borderRadius: RADIUS.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
    },
    findAgainText: { fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.textOnColor },
    disabled: { backgroundColor: theme.border },
    disabledText: { color: theme.textSecondary },
    history: {
      minHeight: 48,
      paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
    },
    historyText: { fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
  });
}
