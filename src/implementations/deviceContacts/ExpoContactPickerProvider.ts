import { requireOptionalNativeModule } from 'expo-modules-core';

import type { ContactPickerProvider, PickedContact } from '../../providers/ContactPickerProvider';

/**
 * The system contact picker, through `expo-contacts`' `presentContactPickerAsync`
 * — on iOS, `CNContactPickerViewController`, which needs no contacts
 * permission (see DEPENDENCIES.md).
 *
 * `expo-contacts` is required lazily: its module calls `requireNativeModule`
 * at import time, which throws in Expo Go and in Jest. Checking first lets the
 * Invite screen simply hide "Choose from contacts" where there is no picker.
 */
const available = requireOptionalNativeModule('ExpoContacts') !== null;

export class ExpoContactPickerProvider implements ContactPickerProvider {
  readonly isAvailable = available;

  async pick(): Promise<PickedContact | null> {
    if (!available) return null;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Contacts = require('expo-contacts') as typeof import('expo-contacts');
    const contact = await Contacts.presentContactPickerAsync();
    if (!contact) return null;
    const name =
      contact.name?.trim() || [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
    return {
      name,
      phoneNumbers: (contact.phoneNumbers ?? [])
        .map((p) => p.number ?? p.digits ?? '')
        .filter((n) => n.trim().length > 0),
    };
  }
}
