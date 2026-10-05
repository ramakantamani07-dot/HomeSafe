/**
 * The distinction this function draws is the whole point of the stale-token
 * pruning feature: get it wrong one way and a dead token gets retried on
 * every SOS/missed-check-in forever; get it wrong the other way and a
 * transient failure (network blip, quota) silently un-registers a contact
 * who would otherwise have received the next real alert fine.
 */
import { isDeadTokenError } from '../shared/messaging';

test('treats an unregistered token as dead', () => {
  expect(isDeadTokenError('messaging/registration-token-not-registered')).toBe(true);
});

test('treats an invalid token as dead', () => {
  expect(isDeadTokenError('messaging/invalid-registration-token')).toBe(true);
});

test('does not treat a transient send failure as dead', () => {
  expect(isDeadTokenError('messaging/internal-error')).toBe(false);
  expect(isDeadTokenError('messaging/server-unavailable')).toBe(false);
  expect(isDeadTokenError('messaging/message-rate-exceeded')).toBe(false);
});

test('does not treat a missing error code as dead', () => {
  expect(isDeadTokenError(undefined)).toBe(false);
});
