import { useContactContext } from '../context/ContactContext';

/**
 * Primary contacts hook for screens.
 * Screens must only interact with contacts through this hook — never
 * import ContactService, ContactProvider, or FirebaseContactProvider directly.
 */
export function useContacts() {
  return useContactContext();
}
