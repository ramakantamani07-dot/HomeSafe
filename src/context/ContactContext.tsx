import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { Contact } from '../models/Contact';
import { sortContacts } from '../models/Contact';
import type { NewContact, ContactUpdates, TestAlertOutcome } from '../providers/ContactProvider';
import type { ContactService } from '../services/ContactService';
import { useAuthContext } from './AuthContext';

interface ContactContextValue {
  contacts: Contact[];
  isLoading: boolean;
  addContact: (input: NewContact) => Promise<Contact>;
  updateContact: (contactId: string, updates: ContactUpdates) => Promise<Contact>;
  deleteContact: (contactId: string) => Promise<void>;
  moveContact: (contactId: string, direction: 'up' | 'down') => Promise<void>;
  sendTestAlert: () => Promise<TestAlertOutcome>;
  /**
   * Whether contacts without the app are texted. Only true where an SMS
   * provider is live, so "a text, even without the app" is never promised
   * where it would not happen.
   */
  smsAlertsEnabled: boolean;
  refresh: () => Promise<void>;
}

export const ContactContext = createContext<ContactContextValue>({
  contacts: [],
  isLoading: false,
  addContact: async () => { throw new Error('ContactContext not mounted.'); },
  updateContact: async () => { throw new Error('ContactContext not mounted.'); },
  deleteContact: async () => {},
  moveContact: async () => {},
  sendTestAlert: async () => ({ status: 'failed' }),
  smsAlertsEnabled: false,
  refresh: async () => {},
});

export function ContactStateProvider({
  contactService,
  smsAlertsEnabled,
  children,
}: {
  contactService: ContactService;
  smsAlertsEnabled: boolean;
  children: React.ReactNode;
}) {
  const { user } = useAuthContext();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setContacts([]);
      return;
    }

    let mounted = true;
    setIsLoading(true);

    contactService
      .getContacts(user.id)
      .then((data) => { if (mounted) setContacts(data); })
      .catch(() => { /* leave contacts empty on load failure */ })
      .finally(() => { if (mounted) setIsLoading(false); });

    return () => { mounted = false; };
  }, [user?.id, contactService]);

  const userId = user?.id ?? null;

  const addContact = useCallback<ContactContextValue['addContact']>(async (input) => {
    if (!userId) throw new Error('You must be signed in.');
    const contact = await contactService.addContact(userId, input);
    setContacts((prev) => sortContacts([...prev, contact]));
    return contact;
  }, [userId, contactService]);

  const updateContact = useCallback<ContactContextValue['updateContact']>(
    async (contactId, updates) => {
      if (!userId) throw new Error('You must be signed in.');
      const updated = await contactService.updateContact(userId, contactId, updates);
      setContacts((prev) => prev.map((c) => (c.id === contactId ? updated : c)));
      return updated;
    },
    [userId, contactService],
  );

  const deleteContact = useCallback<ContactContextValue['deleteContact']>(async (contactId) => {
    if (!userId) throw new Error('You must be signed in.');
    await contactService.deleteContact(userId, contactId);
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
  }, [userId, contactService]);

  const moveContact = useCallback<ContactContextValue['moveContact']>(
    async (contactId, direction) => {
      if (!userId) return;
      setContacts(await contactService.moveContact(userId, contactId, direction));
    },
    [userId, contactService],
  );

  const sendTestAlert = useCallback(() => contactService.sendTestAlert(), [contactService]);

  const refresh = useCallback<ContactContextValue['refresh']>(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      setContacts(await contactService.getContacts(userId));
    } finally {
      setIsLoading(false);
    }
  }, [userId, contactService]);

  const value = useMemo<ContactContextValue>(
    () => ({
      contacts,
      isLoading,
      addContact,
      updateContact,
      deleteContact,
      moveContact,
      sendTestAlert,
      smsAlertsEnabled,
      refresh,
    }),
    [contacts, isLoading, addContact, updateContact, deleteContact, moveContact, sendTestAlert, smsAlertsEnabled, refresh],
  );


  return (
    <ContactContext.Provider value={value}>
      {children}
    </ContactContext.Provider>
  );
}

export function useContactContext(): ContactContextValue {
  return useContext(ContactContext);
}
