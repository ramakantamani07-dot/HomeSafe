import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';
import { describeMemberEvent, type MemberEvent } from '../../models/MemberEvent';
import { Icon } from '../ui/Icon';
import { formatFindTime } from './findCopy';

/**
 * "Messages from Sam" (Phase 6.6): SOS and check-ins sent by text or missed
 * call. An SOS opens the find result, which shows the area that SOS found.
 */
export function MemberEventsSection({
  name,
  events,
  now,
  onOpenSos,
}: {
  name: string;
  events: MemberEvent[];
  now: Date;
  onOpenSos(event: MemberEvent): void;
}) {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>MESSAGES FROM {name.toUpperCase()}</Text>
      {events.length === 0 ? (
        <Text style={styles.note}>
          Nothing yet. {name} can text HELP to wayLoc's number, or ring it and hang up, to alert you —
          and HOME, SCHOOL or OK to check in.
        </Text>
      ) : (
        <View style={styles.card}>
          {events.map((event, i) => {
            const { title, detail } = describeMemberEvent(event, name);
            const sos = event.kind === 'sos';
            const row = (
              <View style={[styles.row, i > 0 && styles.divider]}>
                <Icon name={sos ? 'sos' : 'check'} size={18} color={sos ? theme.critical.fg : theme.safe.fg} />
                <View style={styles.text}>
                  <Text style={[styles.title, sos && styles.titleSos]}>{title}</Text>
                  <Text style={styles.detail}>
                    {formatFindTime(event.at, now)} · {detail}
                  </Text>
                </View>
                {sos && <Icon name="chevronRight" size={16} color={theme.textTertiary} />}
              </View>
            );
            return sos ? (
              <TouchableOpacity key={event.id} onPress={() => onOpenSos(event)} accessibilityRole="button">
                {row}
              </TouchableOpacity>
            ) : (
              <View key={event.id}>{row}</View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    wrap: { gap: SPACING.sm },
    label: { fontSize: 12, fontFamily: FONTS.bodySemibold, letterSpacing: 0.6, color: theme.textSecondary },
    card: { borderRadius: RADIUS.lg, backgroundColor: theme.surface, paddingHorizontal: SPACING.lg },
    row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, minHeight: 56, paddingVertical: SPACING.sm },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
    text: { flex: 1 },
    title: { fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    titleSos: { color: theme.critical.fg },
    detail: { fontSize: 13, fontFamily: FONTS.body, color: theme.textSecondary },
    note: { fontSize: 13, lineHeight: 18, fontFamily: FONTS.body, color: theme.textSecondary },
  });
}
