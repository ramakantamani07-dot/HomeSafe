import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FEATURE_COLORS, FONTS, RADIUS, SPACING, identityColor, type ThemeColors } from '../../config/theme';
import { describeAge } from '../circle/memberStatus';

export interface SummaryPerson {
  id: string;
  name: string;
  kind: 'app' | 'basic';
}

interface FamilySummaryProps {
  people: SummaryPerson[];
  travelling: number;
  needHelp: number;
  /** The newest status anyone in the circle has published. */
  updatedAt: Date | null;
  now: Date;
}

const MAX_AVATARS = 3;

/** "1 other" / "2 others" beside a count already said; "1 person" / "3 people" alone. */
function othersLabel(count: number, afterAnotherCount: boolean): string {
  if (afterAnotherCount) return count === 1 ? 'other' : 'others';
  return count === 1 ? 'person' : 'people';
}

/**
 * The slim line at the top of Family (Option 15 S2b) — replaces the
 * illustration with something that says how the circle is.
 *
 * The board reads "1 travelling · 2 safe". We know who is on a journey; we do
 * not know who is safe, so the rest are counted, not described. Someone who
 * needs help is always named first.
 */
export function FamilySummary({ people, travelling, needHelp, updatedAt, now }: FamilySummaryProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const others = people.length - travelling - needHelp;

  const parts = [
    needHelp > 0 ? `${needHelp} needs help` : null,
    travelling > 0 ? `${travelling} travelling` : null,
    others > 0 ? `${others} ${othersLabel(others, travelling + needHelp > 0)}` : null,
  ].filter(Boolean);
  const age = describeAge(updatedAt, now);

  return (
    <View style={[styles.card, needHelp > 0 && styles.cardAlert]}>
      <View style={styles.avatars}>
        {people.slice(0, MAX_AVATARS).map((p, i) => (
          <View
            key={p.id}
            style={[
              styles.avatar,
              { marginLeft: i === 0 ? 0 : -8, backgroundColor: p.kind === 'basic' ? FEATURE_COLORS.basicPhone : identityColor(theme, p.id) },
            ]}
          >
            <Text style={styles.avatarText}>{p.name.charAt(0).toUpperCase()}</Text>
          </View>
        ))}
      </View>
      <View style={styles.text}>
        <Text style={styles.line}>{parts.join(' · ')}</Text>
        {age && <Text style={styles.age}>Updated {age}</Text>}
      </View>
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      padding: SPACING.md,
      borderRadius: RADIUS.lg,
      backgroundColor: theme.accentMuted,
    },
    cardAlert: { backgroundColor: theme.critical.bg },
    avatars: { flexDirection: 'row' },
    avatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 2,
      borderColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 13, fontFamily: FONTS.heading, color: theme.textOnColor },
    text: { flex: 1 },
    line: { fontSize: 15, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    age: { fontSize: 13, fontFamily: FONTS.body, color: theme.textSecondary },
  });
}
