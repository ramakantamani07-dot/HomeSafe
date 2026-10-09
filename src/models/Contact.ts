/**
 * "Who is Anita to you?" — the trusted-contacts board's chips, in British
 * spelling. `Neighbor` is still read from older records (see
 * `normaliseRelationship`) and never written.
 */
export type ContactRelationship =
  | 'Family'
  | 'Friend'
  | 'Partner'
  | 'Neighbour'
  | 'Colleague'
  | 'Doctor'
  | 'Other';

export const CONTACT_RELATIONSHIPS: ContactRelationship[] = [
  'Family',
  'Friend',
  'Partner',
  'Neighbour',
  'Colleague',
  'Doctor',
  'Other',
];

/** Reads a stored relationship, mapping the old American spelling. */
export function normaliseRelationship(stored: string | undefined): ContactRelationship {
  if (stored === 'Neighbor') return 'Neighbour';
  return (CONTACT_RELATIONSHIPS as string[]).includes(stored ?? '') ? (stored as ContactRelationship) : 'Other';
}

/**
 * What a trusted contact is told about, beyond SOS — which they always get:
 * an SOS that a contact could switch off would be a promise the app had
 * quietly stopped keeping.
 */
export interface ContactAlerts {
  /** A check-in or safety check went unanswered. On by default. */
  missedCheckIn: boolean;
  /** A journey started. Off by default — useful, but it is a lot of texts. */
  journeyStart: boolean;
}

export const DEFAULT_CONTACT_ALERTS: ContactAlerts = { missedCheckIn: true, journeyStart: false };

export const MAX_CONTACTS = 10;

export interface Contact {
  id: string;
  name: string;
  phone: string; // E.164, e.g. "+919876543210"
  relationship: ContactRelationship;
  /**
   * Position in the list, 0 first. The order Emergency mode offers to call
   * them in — "first" means something, so the list shows numbers.
   */
  order: number;
  alerts: ContactAlerts;
  createdAt: Date;
  updatedAt: Date;
}

/** Contacts in their chosen order; ties (older records) by when they were added. */
export function sortContacts(contacts: readonly Contact[]): Contact[] {
  return [...contacts].sort((a, b) => a.order - b.order || a.createdAt.getTime() - b.createdAt.getTime());
}

/** The badges under a name on the list: what this person will be told about. */
export function contactBadges(contact: Contact): string[] {
  return [
    'SOS',
    ...(contact.alerts.missedCheckIn ? ['Late alerts'] : []),
    ...(contact.alerts.journeyStart ? ['Journeys'] : []),
  ];
}

export function contactInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase();
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase();
}
