import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../context/ThemeContext';
import { SPACING, TYPOGRAPHY } from '../../config/theme';
import type { ThemeColors } from '../../config/theme';

export interface LegalSection {
  heading: string;
  body: string;
}

interface LegalDocumentScreenProps {
  title: string;
  lastUpdated: string;
  intro?: string;
  sections: LegalSection[];
}

/**
 * Shared renderer for the Privacy Policy and Terms of Service screens.
 * Reachable both before and after sign-in — see the `(legal)` route group
 * and the NavigationGuard exemption in app/_layout.tsx.
 */
export function LegalDocumentScreen({ title, lastUpdated, intro, sections }: LegalDocumentScreenProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity accessibilityRole="button"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/phone'))}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>{title}</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>Last updated: {lastUpdated}</Text>

        {intro && <Text style={styles.intro}>{intro}</Text>}

        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.background,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    backButton: {
      width: 64,
    },
    backText: {
      fontSize: TYPOGRAPHY.body.fontSize,
      color: theme.accent,
      fontWeight: '600',
    },
    screenTitle: {
      fontSize: TYPOGRAPHY.bodyStrong.fontSize,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    container: {
      padding: SPACING.xl,
      paddingBottom: SPACING.xxxl,
    },
    lastUpdated: {
      fontSize: 12,
      color: theme.textTertiary,
      marginBottom: SPACING.lg,
    },
    intro: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      color: theme.textSecondary,
      lineHeight: 21,
      marginBottom: SPACING.lg,
    },
    section: {
      marginBottom: SPACING.lg,
    },
    heading: {
      fontSize: TYPOGRAPHY.bodyStrong.fontSize - 1,
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: 6,
    },
    body: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      color: theme.textSecondary,
      lineHeight: 21,
    },
  });
}
