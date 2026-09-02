export type ContactRelationship =
  | 'Family'
  | 'Friend'
  | 'Colleague'
  | 'Neighbor'
  | 'Doctor'
  | 'Other';

export const CONTACT_RELATIONSHIPS: ContactRelationship[] = [
  'Family',
  'Friend',
  'Colleague',
  'Neighbor',
  'Doctor',
  'Other',
];

export const MAX_CONTACTS = 10;

export interface Contact {
  id: string;
  name: string;
  phone: string; // E.164, e.g. "+919876543210"
  relationship: ContactRelationship;
  createdAt: Date;
  updatedAt: Date;
}

export function contactInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase();
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase();
}
