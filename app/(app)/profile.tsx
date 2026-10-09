import React, { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';

import { useTheme } from '../../src/context/ThemeContext';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../src/config/theme';
import { useAuth } from '../../src/hooks/useAuth';
import { useContacts } from '../../src/hooks/useContacts';
import { usePlaces } from '../../src/hooks/usePlaces';
import { useGoBack } from '../../src/hooks/useGoBack';
import { useSafetyPreferences } from '../../src/context/SafetyPreferencesContext';
import { Icon, type IconName } from '../../src/components/ui/Icon';

/**
 * Profile (trust board "Profile").
 *
 * Rows, not a form: the number is shown once, and the name saves itself when
 * editing ends — no Save button to forget.
 *
 * Left out of the board, each because it would not work: the camera badge
 * (no photo support exists) and "Change" on the number (changing a verified
 * number needs re-verification, which is not built). Notifications opens
 * wayLoc's page in iOS Settings, which is where those switches live.
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();
  const goBack = useGoBack();
  const { user, signOut, updateProfile } = useAuth();
  const { contacts } = useContacts();
  const { savedPlaces } = usePlaces();
  const { preferences } = useSafetyPreferences();

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(user?.name ?? '');

  const home = savedPlaces.find((p) => p.kind === 'home');
  const medicalFirstLine = preferences.medicalNotes.split('\n')[0]?.trim();
  const version = Constants.expoConfig?.version ?? '';

  const saveName = async () => {
    setEditingName(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === user?.name) {
      setName(user?.name ?? '');
      return;
    }
    try {
      await updateProfile({ name: trimmed });
    } catch {
      setName(user?.name ?? '');
      Alert.alert("Couldn't save your name", 'Check your connection and try again.');
    }
  };

  const confirmSignOut = () =>
    Alert.alert('Sign out?', "You won't get alerts on this phone until you sign in again.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);

  const displayName = user?.name?.trim() || 'Your name';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.round} onPress={goBack} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="chevronLeft" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.round} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <View style={styles.numberRow}>
            <Text style={styles.number}>{user?.phone ?? ''}</Text>
            <Text style={styles.verified}>Verified ✓</Text>
          </View>
        </View>

        <View style={styles.card}>
          {editingName ? (
            <View style={[styles.row]}>
              <RowIcon icon="person" tint={theme.textSecondary} styles={styles} theme={theme} />
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                onBlur={saveName}
                onSubmitEditing={saveName}
                autoFocus
                returnKeyType="done"
                maxLength={60}
                accessibilityLabel="Your name"
              />
            </View>
          ) : (
            <Row icon="person" tint={theme.textSecondary} title="Name" value={displayName} onPress={() => setEditingName(true)} styles={styles} theme={theme} />
          )}
          <Row
            icon="home"
            tint={theme.accent}
            title="Home address"
            value={home?.place ? home.place.name : 'Add'}
            onPress={() => router.push('/(app)/saved-places')}
            divider
            styles={styles}
            theme={theme}
          />
        </View>

        <View style={styles.card}>
          <Row
            icon="activity"
            tint={theme.critical.fg}
            title="Medical ID"
            value={medicalFirstLine || 'Not set'}
            onPress={() => router.push('/(app)/medical-id')}
            styles={styles}
            theme={theme}
          />
          <Row
            icon="shield"
            tint={theme.critical.fg}
            title="Trusted contacts"
            value={String(contacts.length)}
            onPress={() => router.push('/(app)/contacts')}
            divider
            styles={styles}
            theme={theme}
          />
          <Row
            icon="notification"
            tint={theme.warning.fg}
            title="Notifications"
            onPress={() => void Linking.openSettings()}
            divider
            styles={styles}
            theme={theme}
          />
        </View>

        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={confirmSignOut} accessibilityRole="button">
            <Text style={styles.signOut}>Sign out</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.row, styles.divider]}
            onPress={() => router.push('/(app)/delete-account')}
            accessibilityRole="button"
          >
            <Text style={styles.delete}>Delete account</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          wayLoc {version} · Changes save automatically
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function RowIcon({
  icon,
  tint,
  styles,
  theme,
}: {
  icon: IconName;
  tint: string;
  styles: ReturnType<typeof getStyles>;
  theme: ThemeColors;
}) {
  return (
    <View style={[styles.rowIcon, { backgroundColor: tint }]}>
      <Icon name={icon} size={16} color={theme.textOnColor} />
    </View>
  );
}

function Row({
  icon,
  tint,
  title,
  value,
  onPress,
  divider,
  styles,
  theme,
}: {
  icon: IconName;
  tint: string;
  title: string;
  value?: string;
  onPress(): void;
  divider?: boolean;
  styles: ReturnType<typeof getStyles>;
  theme: ThemeColors;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, divider && styles.divider]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${title}, ${value}` : title}
    >
      <RowIcon icon={icon} tint={tint} styles={styles} theme={theme} />
      <Text style={styles.rowTitle}>{title}</Text>
      {value !== undefined && (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      )}
      <Icon name="chevronRight" size={16} color={theme.textTertiary} />
    </TouchableOpacity>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
    },
    round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface },
    headerTitle: { fontSize: 17, fontFamily: FONTS.heading, color: theme.textPrimary },
    container: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
    identity: { alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.sm },
    avatar: {
      width: 104,
      height: 104,
      borderRadius: 52,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.warmMuted,
    },
    avatarText: { fontSize: 44, fontFamily: FONTS.headingXBold, color: theme.warning.fg },
    name: { fontSize: 26, fontFamily: FONTS.headingXBold, color: theme.textPrimary, marginTop: SPACING.sm },
    numberRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    number: { fontSize: 15, fontFamily: FONTS.body, color: theme.textSecondary },
    verified: {
      fontSize: 12,
      fontFamily: FONTS.bodySemibold,
      color: theme.safe.fg,
      backgroundColor: theme.safe.bg,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      borderRadius: RADIUS.pill,
      overflow: 'hidden',
    },
    card: { borderRadius: RADIUS.lg, backgroundColor: theme.surface, paddingHorizontal: SPACING.lg },
    row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, minHeight: 56, paddingVertical: SPACING.sm },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
    rowIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    rowTitle: { flex: 1, fontSize: 16, fontFamily: FONTS.bodyMedium, color: theme.textPrimary },
    rowValue: { maxWidth: '50%', fontSize: 15, fontFamily: FONTS.body, color: theme.textSecondary },
    nameInput: { flex: 1, fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.textPrimary, paddingVertical: SPACING.sm },
    signOut: { fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.accent },
    delete: { fontSize: 16, fontFamily: FONTS.bodySemibold, color: theme.critical.fg },
    footer: { textAlign: 'center', fontSize: 13, fontFamily: FONTS.body, color: theme.textSecondary },
  });
}
