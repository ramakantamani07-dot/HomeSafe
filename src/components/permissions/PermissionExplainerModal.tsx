import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { SPACING, TYPOGRAPHY } from '../../config/theme';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { Icon, type IconName } from '../ui/Icon';

type PermissionType = 'location' | 'locationBackground' | 'notifications';

const CONTENT: Record<
  PermissionType,
  { icon: IconName; title: string; description: string; allowLabel: string }
> = {
  location: {
    icon: 'location',
    title: 'Allow Location Access',
    description:
      'wayLoc uses your location when you start a journey to help your trusted contacts know you are safe.\n\nYour location is never shared in the background without your knowledge.',
    allowLabel: 'Allow Location Access',
  },
  locationBackground: {
    icon: 'compass',
    title: 'Keep Sharing While Your Screen Is Off',
    description:
      "Next, iOS/Android will ask about background location. Choose \"Always Allow\" so your trusted contacts can keep following your journey even when wayLoc isn't on screen or your phone is locked.\n\nIf you choose \"While Using\" instead, tracking pauses the moment you leave the app — that's the one situation this feature exists for.",
    allowLabel: 'Continue',
  },
  notifications: {
    icon: 'notification',
    title: 'Enable Notifications',
    description:
      'wayLoc sends safety alerts and check-in reminders so your trusted contacts can reach you when it matters.\n\nNotifications are only sent when important for your safety.',
    allowLabel: 'Enable Notifications',
  },
};

interface PermissionExplainerModalProps {
  visible: boolean;
  type: PermissionType;
  /**
   * Called when the user taps Allow. The parent is responsible for
   * calling the OS permission API and closing the modal.
   */
  onAllow: () => void;
  onDismiss: () => void;
}

export function PermissionExplainerModal({
  visible,
  type,
  onAllow,
  onDismiss,
}: PermissionExplainerModalProps) {
  const theme = useTheme();
  const { icon, title, description, allowLabel } = CONTENT[type];

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss}>
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: theme.accentMuted }]}>
          <Icon name={icon} size={30} color={theme.accent} />
        </View>
        <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text>

        <Button label={allowLabel} onPress={onAllow} style={styles.allowButton} />
        <Button label="Not now" onPress={onDismiss} variant="ghost" />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: TYPOGRAPHY.heading.fontSize,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: SPACING.md,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: TYPOGRAPHY.body.fontSize,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.body.lineHeight,
    marginBottom: SPACING.xl,
  },
  allowButton: {
    marginBottom: SPACING.sm,
  },
});
