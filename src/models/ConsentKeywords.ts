/**
 * What a member's SMS reply means (network-location spec §4).
 *
 * The reply is the consent. Everything downstream — whether someone can be
 * located at all — turns on reading these four words correctly, from people
 * typing one-handed, in a hurry, in more than one language.
 *
 * **Bias is deliberate and asymmetric.** Approving must be unambiguous; refusing
 * and stopping must be forgiving. A missed YES costs a resend. A missed STOP
 * means continuing to locate someone who asked us not to, which is the failure
 * this whole feature exists to make impossible.
 */
export type ConsentReply = 'approve' | 'decline' | 'stop' | 'unrecognised';

/**
 * Keyword lists, per the spec's "configurable keyword list" with Hindi
 * equivalents.
 *
 * Hindi appears in both Devanagari and Latin transliteration, because people
 * text both — someone replying "HAAN" on a phone without a Devanagari keyboard
 * means exactly what "हाँ" means.
 */
export const CONSENT_KEYWORDS: Readonly<Record<Exclude<ConsentReply, 'unrecognised'>, readonly string[]>> = {
  approve: ['YES', 'Y', 'OK', 'OKAY', 'ACCEPT', 'AGREE', 'हाँ', 'हां', 'HAAN', 'HA', 'JI'],
  decline: ['NO', 'N', 'DECLINE', 'REFUSE', 'नहीं', 'NAHI', 'NAHIN'],
  stop: ['STOP', 'END', 'CANCEL', 'QUIT', 'UNSUBSCRIBE', 'बंद', 'BAND', 'ROKO', 'ROKEN'],
};

/**
 * Strips what phones and people add around a keyword.
 *
 * Punctuation, surrounding quotes and case all vary; none of them changes what
 * someone meant.
 */
function normalise(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[.!?,;:'"()\[\]]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Reads a reply.
 *
 * **STOP is checked first and anywhere in the message**, deliberately breaking
 * the symmetry with the other keywords. "Please stop this", "stop sending me
 * these" and "STOP" must all stop it; requiring an exact match would let a
 * politely-worded withdrawal be silently ignored.
 *
 * Approve and decline require the whole message to be the keyword, because
 * "no, yes is fine" and "yes if you must" are not consent — they are a
 * conversation, and the honest answer to a conversation is to ask again.
 */
export function parseConsentReply(raw: string | null | undefined): ConsentReply {
  if (!raw) return 'unrecognised';
  const text = normalise(raw);
  if (!text) return 'unrecognised';

  const words = text.split(' ');

  if (CONSENT_KEYWORDS.stop.some((k) => words.includes(k))) return 'stop';
  if (CONSENT_KEYWORDS.approve.includes(text)) return 'approve';
  if (CONSENT_KEYWORDS.decline.includes(text)) return 'decline';

  return 'unrecognised';
}
