import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../src/context/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../src/config/theme';
import { contactInitials, MAX_CONTACTS, type Contact } from '../../src/models/Contact';
import { useContacts } from '../../src/hooks/useContacts';
import {
  ContactFormModal,
  type ContactFormData,
} from '../../src/components/contacts/ContactFormModal';
import { Icon } from '../../src/components/ui/Icon';
import { EmptyState } from '../../src/components/ui/EmptyState';
import type { ThemeColors } from '../../src/config/theme';

export default function ContactsScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const { contacts, isLoading, addContact, updateContact, deleteContact } = useContacts();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const atMax = contacts.length >= MAX_CONTACTS;

  const openAdd = () => {
    setEditingContact(null);
    setModalVisible(true);
  };

  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    setModalVisible(true);
  };

  const handleDelete = (contact: Contact) => {
    Alert.alert(
      'Remove contact',
      `Remove ${contact.name} from your trusted contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteContact(contact.id);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Could not remove contact.';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  const handleSave = async (data: ContactFormData) => {
    if (editingContact) {
      await updateContact(editingContact.id, data);
    } else {
      await addContact(data);
    }
  };

  const renderContact = ({ item }: { item: Contact }) => (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{contactInitials(item.name)}</Text>
      </View>

      <View style={styles.cardInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.contactPhone}>{item.phone}</Text>
        <View style={styles.relationshipBadge}>
          <Text style={styles.relationshipText}>{item.relationship}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity accessibilityRole="button"
          style={styles.actionButton}
          onPress={() => openEdit(item)}
          accessibilityLabel={`Edit ${item.name}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="edit" size={19} color={theme.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button"
          style={styles.actionButton}
          onPress={() => handleDelete(item)}
          accessibilityLabel={`Delete ${item.name}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="trash" size={19} color={theme.critical.fg} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Trusted Contacts</Text>
          <Text style={styles.subtitle}>
            {contacts.length} of {MAX_CONTACTS} contacts
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button"
          style={[styles.addButton, atMax && styles.addButtonDisabled]}
          onPress={openAdd}
          disabled={atMax || isLoading}
          activeOpacity={0.8}
        >
          <Text style={[styles.addButtonText, atMax && styles.addButtonTextDisabled]}>
            + Add
          </Text>
        </TouchableOpacity>
      </View>

      {/* List / empty state / loader */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : contacts.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            icon="people"
            title="No trusted contacts yet"
            description="Add people you trust. They'll be ready to help when you need it."
            actionLabel="Add your first contact"
            onAction={openAdd}
          />
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          renderItem={renderContact}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            atMax ? (
              <Text style={styles.maxNote}>
                Maximum of {MAX_CONTACTS} contacts reached.
              </Text>
            ) : null
          }
        />
      )}

      <ContactFormModal
        visible={modalVisible}
        contact={editingContact}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
      />
    </SafeAreaView>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.sm,
      paddingBottom: SPACING.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    title: {
      fontSize: TYPOGRAPHY.heading.fontSize + 2,
      fontWeight: '800',
      color: theme.textPrimary,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      color: theme.textSecondary,
      marginTop: 2,
    },
    addButton: {
      backgroundColor: theme.accent,
      borderRadius: RADIUS.pill,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
    },
    addButtonDisabled: {
      backgroundColor: theme.border,
    },
    addButtonText: {
      color: theme.textOnColor,
      fontSize: TYPOGRAPHY.callout.fontSize,
      fontWeight: '700',
    },
    addButtonTextDisabled: {
      color: theme.textTertiary,
    },
    list: {
      padding: SPACING.lg,
      gap: SPACING.md,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.md + 2,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatarText: {
      color: theme.textOnColor,
      fontSize: 17,
      fontWeight: '700',
    },
    cardInfo: {
      flex: 1,
      gap: 2,
    },
    contactName: {
      fontSize: TYPOGRAPHY.bodyStrong.fontSize,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    contactPhone: {
      fontSize: TYPOGRAPHY.callout.fontSize,
      color: theme.textSecondary,
    },
    relationshipBadge: {
      alignSelf: 'flex-start',
      marginTop: 4,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      borderRadius: 10,
      backgroundColor: theme.accentMuted,
    },
    relationshipText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.accent,
      letterSpacing: 0.3,
    },
    cardActions: {
      flexDirection: 'row',
      gap: SPACING.xs,
      flexShrink: 0,
    },
    actionButton: {
      padding: SPACING.xs + 2,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    maxNote: {
      fontSize: TYPOGRAPHY.caption.fontSize,
      color: theme.textTertiary,
      textAlign: 'center',
      paddingVertical: SPACING.md,
    },
  });
}
