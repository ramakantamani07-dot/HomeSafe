import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { Contact } from '../models/Contact';
import type { NewContact, ContactUpdates } from '../providers/ContactProvider';
import type { ContactService } from '../services/ContactService';
import { useAuthContext } from './AuthContext';

interface ContactContextValue {
  contacts: Contact[];
  isLoading: boolean;
  addContact: (input: NewContact) => Promise<Contact>;
  updateContact: (contactId: string, updates: ContactUpdates) => Promise<Contact>;
  deleteContact: (contactId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const ContactContext = createContext<ContactContextValue>({
  contacts: [],
  isLoading: false,
  addContact: async () => { throw new Error('ContactContext not mounted.'); },
  updateContact: async () => { throw new Error('ContactContext not mounted.'); },
  deleteContact: async () => {},
  refresh: async () => {},
});

export function ContactStateProvider({
  contactService,
  children,
}: {
  contactService: ContactService;
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
    setContacts((prev) => [...prev, contact]);
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
    () => ({ contacts, isLoading, addContact, updateContact, deleteContact, refresh }),
    [contacts, isLoading, addContact, updateContact, deleteContact, refresh],
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
