import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { COLORS } from '../../config/constants';

type PermissionType = 'location' | 'notifications';

const CONTENT: Record<
  PermissionType,
  { icon: string; title: string; description: string; allowLabel: string }
> = {
  location: {
    icon: '📍',
    title: 'Allow Location Access',
    description:
      'HomeSafe uses your location when you start a journey to help your trusted contacts know you are safe.\n\nYour location is never shared in the background without your knowledge.',
    allowLabel: 'Allow Location Access',
  },
  notifications: {
    icon: '🔔',
    title: 'Enable Notifications',
    description:
      'HomeSafe sends safety alerts and check-in reminders so your trusted contacts can reach you when it matters.\n\nNotifications are only sent when important for your safety.',
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
  const { icon, title, description, allowLabel } = CONTENT[type];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.icon}>{icon}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          <TouchableOpacity
            style={styles.allowButton}
            onPress={onAllow}
            activeOpacity={0.85}
          >
            <Text style={styles.allowButtonText}>{allowLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dismissButton}
            onPress={onDismiss}
            activeOpacity={0.7}
          >
            <Text style={styles.dismissButtonText}>Not now</Text>
          </TouchableOpacity>

          <View style={styles.bottomPad} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginTop: 12,
    marginBottom: 24,
  },
  icon: {
    fontSize: 56,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  allowButton: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  allowButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  dismissButton: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  bottomPad: {
    height: 16,
  },
});
