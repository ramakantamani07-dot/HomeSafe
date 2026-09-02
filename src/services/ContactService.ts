import type { ContactProvider, NewContact, ContactUpdates } from '../providers/ContactProvider';
import type { Contact } from '../models/Contact';
import { MAX_CONTACTS } from '../models/Contact';

// E.164: + followed by 7–15 digits (country code + subscriber number)
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

function validateName(name: string): void {
  if (!name) throw new Error('Name is required.');
  if (name.length > 60) throw new Error('Name must be 60 characters or fewer.');
}

function validatePhone(phone: string): void {
  if (!E164_REGEX.test(phone)) {
    throw new Error(
      'Enter a valid phone number with country code (e.g. +919876543210).'
    );
  }
}

export class ContactService {
  constructor(private readonly provider: ContactProvider) {}

  async getContacts(userId: string): Promise<Contact[]> {
    return this.provider.getContacts(userId);
  }

  async addContact(userId: string, input: NewContact): Promise<Contact> {
    const name = input.name.trim();
    const phone = input.phone.trim();

    validateName(name);
    validatePhone(phone);

    const existing = await this.provider.getContacts(userId);

    if (existing.length >= MAX_CONTACTS) {
      throw new Error(`You can have at most ${MAX_CONTACTS} trusted contacts.`);
    }

    if (existing.some((c) => c.phone === phone)) {
      throw new Error('A contact with this phone number already exists.');
    }

    return this.provider.addContact(userId, { name, phone, relationship: input.relationship });
  }

  async updateContact(
    userId: string,
    contactId: string,
    rawUpdates: ContactUpdates
  ): Promise<Contact> {
    const updates: ContactUpdates = { ...rawUpdates };

    if (updates.name !== undefined) {
      updates.name = updates.name.trim();
      validateName(updates.name);
    }

    if (updates.phone !== undefined) {
      updates.phone = updates.phone.trim();
      validatePhone(updates.phone);

      const existing = await this.provider.getContacts(userId);
      if (existing.some((c) => c.phone === updates.phone && c.id !== contactId)) {
        throw new Error('A contact with this phone number already exists.');
      }
    }

    return this.provider.updateContact(userId, contactId, updates);
  }

  async deleteContact(userId: string, contactId: string): Promise<void> {
    return this.provider.deleteContact(userId, contactId);
  }
}
