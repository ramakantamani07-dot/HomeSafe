import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  query,
  orderBy,
  Firestore,
} from 'firebase/firestore';
import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import type { FirebaseApp } from 'firebase/app';

import type { ContactProvider, NewContact, ContactUpdates, TestAlertOutcome } from '../../providers/ContactProvider';
import type { Contact, ContactAlerts } from '../../models/Contact';
import { DEFAULT_CONTACT_ALERTS, normaliseRelationship } from '../../models/Contact';

type StoredContact = {
  name: string;
  phone: string;
  relationship: string;
  order?: number;
  alerts?: ContactAlerts;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

function contactsCol(db: Firestore, userId: string) {
  return collection(db, 'users', userId, 'contacts');
}

function contactDoc(db: Firestore, userId: string, contactId: string) {
  return doc(db, 'users', userId, 'contacts', contactId);
}

function fromFirestore(id: string, data: StoredContact): Contact {
  return {
    id,
    name: data.name,
    phone: data.phone,
    relationship: normaliseRelationship(data.relationship),
    // Older records have neither: they sort by age and keep today's
    // behaviour — told about everything except journey starts.
    order: data.order ?? 0,
    alerts: { ...DEFAULT_CONTACT_ALERTS, ...data.alerts },
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
  };
}

export class FirebaseContactProvider implements ContactProvider {
  private readonly db: Firestore;
  private readonly functions: Functions;

  constructor(app: FirebaseApp) {
    this.db = getFirestore(app);
    this.functions = getFunctions(app);
  }

  async sendTestAlert(): Promise<TestAlertOutcome> {
    try {
      const call = httpsCallable<void, { pushed: number; texted: number }>(this.functions, 'sendTestAlert');
      const { data } = await call();
      return { status: 'sent', pushed: data.pushed, texted: data.texted };
    } catch (err) {
      const refusal = (err as { details?: { refusal?: string } }).details?.refusal;
      return refusal === 'too-soon' ? { status: 'too-soon' } : { status: 'failed' };
    }
  }

  async getContacts(userId: string): Promise<Contact[]> {
    const q = query(contactsCol(this.db, userId), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => fromFirestore(d.id, d.data() as StoredContact));
  }

  async addContact(userId: string, contact: NewContact): Promise<Contact> {
    const now = Timestamp.now();
    const data: StoredContact = {
      name: contact.name,
      phone: contact.phone,
      relationship: contact.relationship,
      order: contact.order ?? 0,
      alerts: contact.alerts ?? DEFAULT_CONTACT_ALERTS,
      createdAt: now,
      updatedAt: now,
    };
    const ref = await addDoc(contactsCol(this.db, userId), data);
    return fromFirestore(ref.id, data);
  }

  async updateContact(userId: string, contactId: string, updates: ContactUpdates): Promise<Contact> {
    const ref = contactDoc(this.db, userId, contactId);
    await updateDoc(ref, { ...updates, updatedAt: Timestamp.now() });
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Contact not found after update.');
    return fromFirestore(snap.id, snap.data() as StoredContact);
  }

  async deleteContact(userId: string, contactId: string): Promise<void> {
    await deleteDoc(contactDoc(this.db, userId, contactId));
  }
}
