import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { RADIUS, SPACING } from '../../config/theme';

interface BottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
}

/**
 * The shell (overlay + rounded-top surface + drag handle) that
 * PermissionExplainerModal and PinEntryModal each
 * hand-rolled separately. Content (title/description/form/buttons) stays as
 * children rather than a fixed prop API — those three use cases are shaped
 * too differently to force into one rigid template. See the redesign audit
 * §7.
 */
export function BottomSheet({ visible, onDismiss, children }: BottomSheetProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityLabel="Dismiss"
          accessibilityRole="button"
        />
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          {children}
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
    borderTopLeftRadius: RADIUS.lg + 8,
    borderTopRightRadius: RADIUS.lg + 8,
    paddingHorizontal: SPACING.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  bottomPad: {
    height: SPACING.md,
  },
});
