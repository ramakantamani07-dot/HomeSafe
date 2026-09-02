import React, { createContext, useContext, useEffect, useState } from 'react';

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

  const value: ContactContextValue = {
    contacts,
    isLoading,

    addContact: async (input) => {
      if (!user) throw new Error('You must be signed in.');
      const contact = await contactService.addContact(user.id, input);
      setContacts((prev) => [...prev, contact]);
      return contact;
    },

    updateContact: async (contactId, updates) => {
      if (!user) throw new Error('You must be signed in.');
      const updated = await contactService.updateContact(user.id, contactId, updates);
      setContacts((prev) => prev.map((c) => (c.id === contactId ? updated : c)));
      return updated;
    },

    deleteContact: async (contactId) => {
      if (!user) throw new Error('You must be signed in.');
      await contactService.deleteContact(user.id, contactId);
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
    },

    refresh: async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const data = await contactService.getContacts(user.id);
        setContacts(data);
      } finally {
        setIsLoading(false);
      }
    },
  };

  return (
    <ContactContext.Provider value={value}>
      {children}
    </ContactContext.Provider>
  );
}

export function useContactContext(): ContactContextValue {
  return useContext(ContactContext);
}
