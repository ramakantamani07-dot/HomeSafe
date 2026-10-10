/**
 * Wrong sign-in codes, and the lock that follows too many (Option 15 §4:
 * "Lock for 10 minutes after 5 tries").
 *
 * Pure, so the rule is tested without a screen or a clock. `AuthService`
 * holds one record per phone number; the screens only read what the errors
 * below carry.
 *
 * This is the app's own lock, on top of the provider's. Firebase limits
 * attempts server-side as well (`auth/too-many-requests`); the lock here is
 * what lets the screen say "2 tries left" truthfully, which a server limit
 * with undisclosed thresholds cannot.
 */

export const MAX_CODE_ATTEMPTS = 5;
export const CODE_LOCKOUT_MS = 10 * 60 * 1000;

export interface CodeAttempts {
  /** Wrong codes since the last success or the end of the last lock. */
  readonly failures: number;
  /** Epoch ms; null when not locked. */
  readonly lockedUntil: number | null;
}

export const NO_ATTEMPTS: CodeAttempts = { failures: 0, lockedUntil: null };

/** A lock that has run out is no lock, and its failures are forgiven. */
export function settle(attempts: CodeAttempts, now: number): CodeAttempts {
  if (attempts.lockedUntil !== null && now >= attempts.lockedUntil) return NO_ATTEMPTS;
  return attempts;
}

export function isLocked(attempts: CodeAttempts, now: number): boolean {
  const settled = settle(attempts, now);
  return settled.lockedUntil !== null;
}

export function triesLeft(attempts: CodeAttempts): number {
  return Math.max(0, MAX_CODE_ATTEMPTS - attempts.failures);
}

export function recordWrongCode(attempts: CodeAttempts, now: number): CodeAttempts {
  const settled = settle(attempts, now);
  const failures = settled.failures + 1;
  return failures >= MAX_CODE_ATTEMPTS
    ? { failures, lockedUntil: now + CODE_LOCKOUT_MS }
    : { failures, lockedUntil: null };
}

/**
 * The code was not the one sent. Thrown by an `AuthProvider` for exactly
 * that case and nothing else, so a dropped connection is never counted
 * against someone's tries.
 */
export class WrongCodeError extends Error {
  /** Filled in by `AuthService`, which keeps the count. */
  triesLeft = MAX_CODE_ATTEMPTS;

  constructor() {
    super("That code didn't match.");
    this.name = 'WrongCodeError';
  }
}

/** Too many wrong codes for this number; nothing is sent or checked until `until`. */
export class SignInLockedError extends Error {
  constructor(public readonly until: Date) {
    super('Too many wrong codes.');
    this.name = 'SignInLockedError';
  }
}
