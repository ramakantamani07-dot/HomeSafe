/**
 * Sign-in wording that depends on numbers, kept pure so it is tested
 * (`signIn.test.ts`) rather than eyeballed.
 */

/** "That code didn't match. 2 tries left." (AN4) */
export function wrongCodeMessage(triesLeft: number): string {
  return `That code didn’t match. ${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left.`;
}

/** Whole minutes, rounded up and at least 1, so the wait is never understated. */
export function lockedMessage(until: Date, now: Date): string {
  const minutes = Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 60_000));
  return `Too many wrong codes. Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`;
}

/** 54 → "0:54", 60 → "1:00". */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
