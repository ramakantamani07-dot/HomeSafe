import { useMemo } from 'react';

import { useContactContext } from '../context/ContactContext';
import { useIdentityGuard } from './useIdentityGuard';

/**
 * Primary contacts hook for screens.
 * Screens must only interact with contacts through this hook — never
 * import ContactService, ContactProvider, or FirebaseContactProvider directly.
 *
 * Adding, changing and removing a trusted contact decide who is told when you
 * press SOS, so each asks the phone's owner to confirm it is them. Reordering
 * does not: it changes no one's access.
 */
export function useContacts() {
  const contacts = useContactContext();
  const guard = useIdentityGuard();
  const { addContact, updateContact, deleteContact } = contacts;
  return useMemo(
    () => ({
      ...contacts,
      addContact: guard('add-trusted-contact', addContact),
      updateContact: guard('change-trusted-contact', updateContact),
      deleteContact: guard('remove-trusted-contact', deleteContact),
    }),
    [contacts, guard, addContact, updateContact, deleteContact],
  );
}
