import type { ContactProvider, NewContact, ContactUpdates, TestAlertOutcome } from '../../providers/ContactProvider';
import type { Contact } from '../../models/Contact';
import { DEFAULT_CONTACT_ALERTS } from '../../models/Contact';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class MockContactProvider implements ContactProvider {
  private store: Map<string, Map<string, Contact>> = new Map();
  private nextId = 1;

  private userStore(userId: string): Map<string, Contact> {
    if (!this.store.has(userId)) {
      this.store.set(userId, new Map());
    }
    return this.store.get(userId)!;
  }

  async getContacts(userId: string): Promise<Contact[]> {
    await delay(300);
    return Array.from(this.userStore(userId).values()).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
  }

  async addContact(userId: string, contact: NewContact): Promise<Contact> {
    await delay(300);
    const now = new Date();
    const id = `mock-contact-${this.nextId++}`;
    const newContact: Contact = {
      ...contact,
      order: contact.order ?? 0,
      alerts: contact.alerts ?? DEFAULT_CONTACT_ALERTS,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.userStore(userId).set(id, newContact);
    return newContact;
  }

  async updateContact(userId: string, contactId: string, updates: ContactUpdates): Promise<Contact> {
    await delay(300);
    const store = this.userStore(userId);
    const existing = store.get(contactId);
    if (!existing) throw new Error('Contact not found.');
    const updated: Contact = {
      ...existing,
      ...updates,
      id: contactId,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    store.set(contactId, updated);
    return updated;
  }

  async deleteContact(userId: string, contactId: string): Promise<void> {
    await delay(300);
    this.userStore(userId).delete(contactId);
  }

  /** No server in mock mode: nothing can be sent, and the screen says so. */
  async sendTestAlert(): Promise<TestAlertOutcome> {
    return { status: 'demo' };
  }
}
