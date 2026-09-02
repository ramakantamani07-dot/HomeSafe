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

import { COLORS } from '../../src/config/constants';
import { contactInitials, MAX_CONTACTS, type Contact } from '../../src/models/Contact';
import { useContacts } from '../../src/hooks/useContacts';
import {
  ContactFormModal,
  type ContactFormData,
} from '../../src/components/contacts/ContactFormModal';

export default function ContactsScreen() {
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
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openEdit(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.actionIcon}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDelete(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.actionIcon}>🗑️</Text>
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
        <TouchableOpacity
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
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : contacts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>No trusted contacts yet</Text>
          <Text style={styles.emptyDesc}>
            Add people you trust. They'll be ready to help when you need it.
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={openAdd} activeOpacity={0.8}>
            <Text style={styles.emptyButtonText}>Add your first contact</Text>
          </TouchableOpacity>
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  addButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  addButtonTextDisabled: {
    color: COLORS.textMuted,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  contactPhone: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  relationshipBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
  },
  relationshipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.3,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 4,
    flexShrink: 0,
  },
  actionButton: {
    padding: 6,
  },
  actionIcon: {
    fontSize: 18,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  emptyButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  maxNote: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
