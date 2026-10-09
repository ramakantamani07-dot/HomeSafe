import type { TestAlertOutcome } from '../providers/ContactProvider';
import type { ContactProvider, NewContact, ContactUpdates } from '../providers/ContactProvider';
import type { Contact } from '../models/Contact';
import { DEFAULT_CONTACT_ALERTS, MAX_CONTACTS, sortContacts } from '../models/Contact';

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
    return sortContacts(await this.provider.getContacts(userId));
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

    // New contacts join the end of the order: adding someone never silently
    // changes who Emergency mode offers to call first.
    const order = existing.reduce((max, c) => Math.max(max, c.order + 1), 0);
    return this.provider.addContact(userId, {
      name,
      phone,
      relationship: input.relationship,
      alerts: input.alerts ?? DEFAULT_CONTACT_ALERTS,
      order,
    });
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

  /**
   * Moves a contact one place up or down. Rewrites every position from the
   * sorted list, so gaps left by deletions and ties from older records
   * (which all had order 0) are repaired by the first move.
   */
  async moveContact(userId: string, contactId: string, direction: 'up' | 'down'): Promise<Contact[]> {
    const list = sortContacts(await this.provider.getContacts(userId));
    const from = list.findIndex((c) => c.id === contactId);
    const to = direction === 'up' ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= list.length) return list;
    [list[from], list[to]] = [list[to], list[from]];
    await Promise.all(
      list.map((c, i) => (c.order === i ? null : this.provider.updateContact(userId, c.id, { order: i }))),
    );
    return list.map((c, i) => ({ ...c, order: i }));
  }

  sendTestAlert(): Promise<TestAlertOutcome> {
    return this.provider.sendTestAlert();
  }

  async deleteContact(userId: string, contactId: string): Promise<void> {
    return this.provider.deleteContact(userId, contactId);
  }
}
