/** Which trusted contacts hear about what (Phase 5c). */
import { wantsAlert } from '../shared/messaging';
import { TEST_ALERT_MIN_INTERVAL_MS, testAlertAllowed } from '../alerts/contacts';

const base = { name: 'Anita', phone: '+919845012345' };

test('SOS reaches everyone — it cannot be switched off', () => {
  expect(wantsAlert({ ...base, alerts: { missedCheckIn: false, journeyStart: false } }, 'sos')).toBe(true);
});

test('older contacts keep today’s behaviour: missed check-ins yes, journey starts no', () => {
  expect(wantsAlert(base, 'missedCheckIn')).toBe(true);
  expect(wantsAlert(base, 'journeyStart')).toBe(false);
});

test('each switch is respected', () => {
  expect(wantsAlert({ ...base, alerts: { missedCheckIn: false } }, 'missedCheckIn')).toBe(false);
  expect(wantsAlert({ ...base, alerts: { journeyStart: true } }, 'journeyStart')).toBe(true);
});

test('one test alert an hour', () => {
  const now = new Date('2026-10-09T12:00:00Z');
  expect(testAlertAllowed(null, now)).toBe(true);
  expect(testAlertAllowed(new Date(now.getTime() - TEST_ALERT_MIN_INTERVAL_MS + 1_000), now)).toBe(false);
  expect(testAlertAllowed(new Date(now.getTime() - TEST_ALERT_MIN_INTERVAL_MS), now)).toBe(true);
});
