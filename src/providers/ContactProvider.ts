import type { Contact, ContactAlerts, ContactRelationship } from '../models/Contact';

export type NewContact = {
  name: string;
  phone: string;
  relationship: ContactRelationship;
  alerts?: ContactAlerts;
  /** Set by the service to the end of the list; callers leave it out. */
  order?: number;
};

export type ContactUpdates = Partial<NewContact>;

/**
 * What "Send a test alert" did. `demo` when nothing could be sent at all
 * (mock data), so the screen says so instead of claiming a delivery.
 */
export type TestAlertOutcome =
  | { status: 'sent'; pushed: number; texted: number }
  | { status: 'too-soon' }
  | { status: 'demo' }
  | { status: 'failed' };

export interface ContactProvider {
  getContacts(userId: string): Promise<Contact[]>;
  addContact(userId: string, contact: NewContact): Promise<Contact>;
  updateContact(userId: string, contactId: string, updates: ContactUpdates): Promise<Contact>;
  deleteContact(userId: string, contactId: string): Promise<void>;
  /** Sends every contact a message marked TEST, by push or text. Never throws. */
  sendTestAlert(): Promise<TestAlertOutcome>;
}
