import { ContactService } from '../services/ContactService';
import { MockContactProvider } from '../implementations/contacts/MockContactProvider';
import { contactBadges, normaliseRelationship, sortContacts, DEFAULT_CONTACT_ALERTS } from '../models/Contact';

function service() {
  return new ContactService(new MockContactProvider());
}

test('new contacts join the end of the order, with default alerts', async () => {
  const s = service();
  await s.addContact('me', { name: 'Mum', phone: '+447911000001', relationship: 'Family' });
  const alex = await s.addContact('me', { name: 'Alex', phone: '+447911000002', relationship: 'Friend' });
  expect(alex.order).toBe(1);
  expect(alex.alerts).toEqual(DEFAULT_CONTACT_ALERTS);
  expect((await s.getContacts('me')).map((c) => c.name)).toEqual(['Mum', 'Alex']);
});

test('moving changes who is first, and stops at the ends', async () => {
  const s = service();
  await s.addContact('me', { name: 'Mum', phone: '+447911000001', relationship: 'Family' });
  const alex = await s.addContact('me', { name: 'Alex', phone: '+447911000002', relationship: 'Friend' });
  expect((await s.moveContact('me', alex.id, 'up')).map((c) => c.name)).toEqual(['Alex', 'Mum']);
  expect((await s.moveContact('me', alex.id, 'up')).map((c) => c.name)).toEqual(['Alex', 'Mum']);
  expect((await s.getContacts('me')).map((c) => c.name)).toEqual(['Alex', 'Mum']);
});

test('older records with no order sort by when they were added', () => {
  const at = (ms: number) => new Date(ms);
  const base = { phone: '', relationship: 'Family' as const, alerts: DEFAULT_CONTACT_ALERTS, updatedAt: at(0) };
  const sorted = sortContacts([
    { ...base, id: 'b', name: 'B', order: 0, createdAt: at(2) },
    { ...base, id: 'a', name: 'A', order: 0, createdAt: at(1) },
  ]);
  expect(sorted.map((c) => c.id)).toEqual(['a', 'b']);
});

test('badges say what each person will be told about — SOS always', () => {
  const c = { id: 'x', name: 'Anita', phone: '', relationship: 'Neighbour' as const, order: 0, createdAt: new Date(), updatedAt: new Date() };
  expect(contactBadges({ ...c, alerts: { missedCheckIn: false, journeyStart: false } })).toEqual(['SOS']);
  expect(contactBadges({ ...c, alerts: { missedCheckIn: true, journeyStart: true } })).toEqual(['SOS', 'Late alerts', 'Journeys']);
});

test('the old spelling still reads, and unknown values fall back to Other', () => {
  expect(normaliseRelationship('Neighbor')).toBe('Neighbour');
  expect(normaliseRelationship('Partner')).toBe('Partner');
  expect(normaliseRelationship('Cousin')).toBe('Other');
});
