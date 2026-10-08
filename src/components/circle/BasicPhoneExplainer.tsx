import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../config/theme';

/**
 * "How it works with a basic phone" (Option 15 S4).
 *
 * Three steps, each one true of the system as built. Two differ from the board
 * on purpose:
 *  - the network step says "may": whether the operator contacts them depends
 *    on the operator's consent strategy, which we do not know at this point;
 *  - the last step says "at most once an hour", because the transparency text
 *    is throttled (spec §5). The board's "every time you look" would be a
 *    promise the server deliberately does not keep.
 */
export function BasicPhoneExplainer({ name }: { name: string }) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const who = name.trim() || 'They';

  const steps = [
    `${who} gets a text and replies YES — no app or internet needed.`,
    'Their mobile network may text them once to confirm.',
    `You can then see an approximate area. ${who} is texted when you look, at most once an hour, and can text STOP anytime.`,
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>How it works with a basic phone</Text>
      {steps.map((step, i) => (
        <View key={i} style={styles.step}>
          <Text style={styles.number}>{i + 1}</Text>
          <Text style={styles.text}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    card: {
      padding: SPACING.lg,
      borderRadius: RADIUS.lg,
      backgroundColor: theme.surface,
      gap: SPACING.sm,
    },
    title: { fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.textPrimary },
    step: { flexDirection: 'row', gap: SPACING.sm },
    number: { width: 16, fontSize: 15, fontFamily: FONTS.bodySemibold, color: theme.accent },
    text: { flex: 1, fontSize: 15, lineHeight: 21, fontFamily: FONTS.body, color: theme.textSecondary },
  });
}
