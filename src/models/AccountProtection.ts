/**
 * Account protection (docs/reference/ACCOUNT_PROTECTION.md).
 *
 * Phone-number sign-in means whoever controls the number can sign in — a
 * stolen SIM, or a SIM swap at the carrier. In a location app that is the
 * most valuable account to take over. These are the app's answers that need
 * no second login factor:
 *
 *  - changes that widen who can find you, or who is told when you need help,
 *    ask the phone's owner to confirm it is them (Face ID / Touch ID /
 *    passcode) first;
 *  - a sign-in on a new phone warns the account's other phones and the family
 *    (server: `onDeviceRegistered`);
 *  - a monthly reminder to check who can see you.
 *
 * Never gated, whatever the setting: SOS, I'm OK, stopping sharing, removing
 * someone who can see you. A safety action that waits on a face scan has
 * failed, and anything that narrows exposure is something an attacker would
 * not want done.
 */

/** Why the phone's owner is being asked to confirm it is them. */
export type ProtectedAction =
  | 'invite-family'
  | 'accept-family'
  | 'add-basic-phone'
  | 'add-safe-zone'
  | 'add-trusted-contact'
  | 'change-trusted-contact'
  | 'remove-trusted-contact';

/** What the system prompt says — a reason the person recognises. */
export const PROTECTED_ACTION_PROMPT: Record<ProtectedAction, string> = {
  'invite-family': 'Confirm it’s you to invite someone to see your location',
  'accept-family': 'Confirm it’s you to share your location with this family',
  'add-basic-phone': 'Confirm it’s you to add someone to find',
  'add-safe-zone': 'Confirm it’s you to add a safe zone',
  'add-trusted-contact': 'Confirm it’s you to add a trusted contact',
  'change-trusted-contact': 'Confirm it’s you to change a trusted contact',
  'remove-trusted-contact': 'Confirm it’s you to remove a trusted contact',
};

/**
 * The person cancelled the Face ID / passcode prompt, or it failed. Screens
 * treat it as "nothing happened" — they show no error, because the person
 * either chose not to or will simply try again.
 */
export class IdentityNotConfirmedError extends Error {
  constructor() {
    super('Not confirmed.');
    this.name = 'IdentityNotConfirmedError';
  }
}

export function isIdentityNotConfirmed(err: unknown): boolean {
  return err instanceof IdentityNotConfirmedError;
}

/** How often to remind someone to check who can see their location. */
export const SHARING_REVIEW_INTERVAL_DAYS = 30;

/** The reminder's notification id and the `data.type` a tap is routed on. */
export const SHARING_REVIEW_ID = 'wayloc.sharing-review';
export const SHARING_REVIEW_TYPE = 'SHARING_REVIEW';
