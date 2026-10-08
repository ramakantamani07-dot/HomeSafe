import { parseConsentReply } from '../models/ConsentKeywords';

describe('approval', () => {
  it('reads the obvious forms, in either language', () => {
    for (const reply of ['YES', 'yes', 'Y', 'ok', 'Accept', 'हाँ', 'haan', 'JI']) {
      expect(parseConsentReply(reply)).toBe('approve');
    }
  });

  it('tolerates punctuation and stray whitespace', () => {
    expect(parseConsentReply('  yes!  ')).toBe('approve');
    expect(parseConsentReply('"YES"')).toBe('approve');
  });

  it('refuses anything that is a sentence rather than an answer', () => {
    // "yes if you must" is a conversation, not consent. Asking again is the
    // honest response; assuming agreement is not.
    expect(parseConsentReply('yes if you must')).toBe('unrecognised');
    expect(parseConsentReply('I think yes')).toBe('unrecognised');
  });
});

describe('decline', () => {
  it('reads the obvious forms, in either language', () => {
    for (const reply of ['NO', 'no', 'N', 'refuse', 'नहीं', 'nahi']) {
      expect(parseConsentReply(reply)).toBe('decline');
    }
  });
});

describe('STOP is treated more forgivingly than anything else', () => {
  it('is honoured anywhere in the message', () => {
    // The asymmetry is the point: a missed YES costs a resend, a missed STOP
    // means continuing to locate someone who asked us not to.
    expect(parseConsentReply('STOP')).toBe('stop');
    expect(parseConsentReply('please stop this')).toBe('stop');
    expect(parseConsentReply('stop sending me these messages')).toBe('stop');
    expect(parseConsentReply('बंद')).toBe('stop');
    expect(parseConsentReply('roko')).toBe('stop');
  });

  it('wins over an approval in the same message', () => {
    // "yes stop" is not an approval. When a message contains both, the safe
    // reading is the one that shares less.
    expect(parseConsentReply('yes stop')).toBe('stop');
  });
});

describe('anything unclear is unrecognised, never guessed', () => {
  it('returns unrecognised rather than defaulting either way', () => {
    for (const reply of ['maybe', 'what is this', '?', '', '   ', null, undefined]) {
      expect(parseConsentReply(reply)).toBe('unrecognised');
    }
  });
});
