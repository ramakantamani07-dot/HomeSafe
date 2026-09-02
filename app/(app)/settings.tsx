import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { COLORS } from '../../src/config/constants';
import { useAuth } from '../../src/hooks/useAuth';

interface SettingRowProps {
  icon: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
}

function SettingRow({ icon, title, subtitle, onPress }: SettingRowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      {onPress && <Text style={styles.chevron}>›</Text>}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.section}>Account</Text>
        <View style={styles.card}>
          <SettingRow
            icon="📱"
            title="Verified phone"
            subtitle={user?.phone ?? 'Signed in with phone OTP'}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="👤"
            title="Profile"
            subtitle={user?.name ? user.name : 'Name not added yet'}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="🚪"
            title="Sign out"
            subtitle="Clear the local session on this device"
            onPress={signOut}
          />
        </View>

        <Text style={styles.section}>Privacy</Text>
        <View style={styles.card}>
          <SettingRow
            icon="🛡️"
            title="Privacy & Security"
            subtitle="Permissions, biometric lock, and data settings"
            onPress={() => router.push('/(app)/privacy')}
          />
        </View>

        <Text style={styles.section}>Storage</Text>
        <View style={styles.card}>
          <SettingRow
            icon="🔒"
            title="Local secure storage"
            subtitle="Session and profile preferences are stored on this device"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: 20, paddingBottom: 40 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 24,
    letterSpacing: -0.3,
  },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 8,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: 20,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowIcon: { fontSize: 22, width: 28, textAlign: 'center' },
  rowText: { flex: 1 },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  rowSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: 18,
    color: COLORS.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 56,
  },
});
