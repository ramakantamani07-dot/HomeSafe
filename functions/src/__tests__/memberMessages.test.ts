/** What a basic-phone member's text asks for (Phase 6.6). */
import { classifyMemberMessage, mayBeConsentReply } from '../networkLocation/memberMessages';
import { parseConsentReply } from '../networkLocation/consent';

test('HELP anywhere, in either language and script', () => {
  for (const body of ['HELP', 'please help me', 'sos', 'मदद', 'bachao!', 'Emergency.']) {
    expect(classifyMemberMessage(body).help).toBe(true);
  }
});

test('check-ins only as the whole message', () => {
  expect(classifyMemberMessage('home').checkIn).toBe('Home');
  expect(classifyMemberMessage('घर').checkIn).toBe('Home');
  expect(classifyMemberMessage('School!').checkIn).toBe('School');
  expect(classifyMemberMessage('theek').checkIn).toBe('OK');
  expect(classifyMemberMessage('ok but scared').checkIn).toBeNull();
});

test('help outranks a check-in in the same message', () => {
  expect(classifyMemberMessage('home help')).toEqual({ help: true, checkIn: null });
});

test('"OK" approves a waiting request only while nothing is ACTIVE', () => {
  const ok = classifyMemberMessage('OK');
  expect(parseConsentReply('OK')).toBe('approve');
  expect(mayBeConsentReply(ok, false)).toBe(true);
  expect(mayBeConsentReply(ok, true)).toBe(false);
});

test('ordinary chatter is neither', () => {
  expect(classifyMemberMessage('see you later')).toEqual({ help: false, checkIn: null });
  expect(classifyMemberMessage('')).toEqual({ help: false, checkIn: null });
});
