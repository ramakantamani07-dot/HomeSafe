import type { Contact, ContactRelationship } from '../models/Contact';

export type NewContact = {
  name: string;
  phone: string;
  relationship: ContactRelationship;
};

export type ContactUpdates = Partial<NewContact>;

export interface ContactProvider {
  getContacts(userId: string): Promise<Contact[]>;
  addContact(userId: string, contact: NewContact): Promise<Contact>;
  updateContact(userId: string, contactId: string, updates: ContactUpdates): Promise<Contact>;
  deleteContact(userId: string, contactId: string): Promise<void>;
}
