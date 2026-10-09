import { normalise } from './consent';

/**
 * What a basic-phone member's text asks for, beyond consent (Phase 6.6,
 * spec §7): help, or a check-in. Consent replies (YES / NO / STOP) are read by
 * `parseConsentReply`; this reads the rest. English and Hindi, in Devanagari
 * and Latin script, because people text both.
 */

/** Read anywhere in the message, like STOP: a missed SOS is the worse failure. */
export const HELP_KEYWORDS: readonly string[] = ['HELP', 'SOS', 'EMERGENCY', 'मदद', 'बचाओ', 'BACHAO', 'MADAD'];

export type CheckInLabel = 'Home' | 'School' | 'OK';

/** Whole-message only, like YES: "ok but scared" is not a check-in, it is a conversation. */
export const CHECK_IN_KEYWORDS: Readonly<Record<CheckInLabel, readonly string[]>> = {
  Home: ['HOME', 'घर', 'GHAR'],
  School: ['SCHOOL', 'स्कूल', 'SKOOL'],
  OK: ['OK', 'OKAY', 'FINE', 'ठीक', 'THEEK', 'THIK'],
};

export interface MemberMessage {
  help: boolean;
  checkIn: CheckInLabel | null;
}

export function classifyMemberMessage(raw: string | null | undefined): MemberMessage {
  const text = raw ? normalise(raw) : '';
  if (!text) return { help: false, checkIn: null };
  const words = text.split(' ');
  const help = HELP_KEYWORDS.some((k) => words.includes(k));
  const checkIn =
    help
      ? null
      : ((Object.keys(CHECK_IN_KEYWORDS) as CheckInLabel[]).find((label) =>
          CHECK_IN_KEYWORDS[label].includes(text),
        ) ?? null);
  return { help, checkIn };
}

/**
 * Whether the body may be read as a consent reply too.
 *
 * "OK" is both a YES and a check-in. Once the number has an ACTIVE consent,
 * a check-in word is a check-in — it must never double as a silent approval
 * for a second guardian still waiting, because approving has to be
 * unambiguous (D18).
 */
export function mayBeConsentReply(message: MemberMessage, hasActiveConsent: boolean): boolean {
  return !(message.checkIn && hasActiveConsent);
}
