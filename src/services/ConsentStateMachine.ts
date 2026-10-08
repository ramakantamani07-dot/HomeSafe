import type { ConsentStatus, ConsentTrigger } from '../models/Consent';
import { isTerminal } from '../models/Consent';

/**
 * The consent lifecycle, as a pure function of state and event.
 *
 * ```
 * PENDING_SMS -> SMS_APPROVED -> OPERATOR_PENDING -> ACTIVE
 * Any state   -> DECLINED / EXPIRED / REVOKED
 * ```
 *
 * **Why a pure module and not a context or a Firestore routine.** This decides
 * whether one person may see another person's location. It has to be
 * exhaustively testable with no emulator, no network and no mocking, and it has
 * to read the same on the client and in Cloud Functions — the server enforces
 * it, and the client must predict the server's answer to show honest UI.
 *
 * The transitions are deliberately narrow. `ACTIVE` is reachable **only** from
 * `OPERATOR_PENDING`, so no event, bug or hand-written Firestore write can skip
 * the operator check by jumping states.
 */
export type ConsentEventKind =
  | 'sms-approved'
  | 'sms-declined'
  | 'operator-requested'
  | 'operator-approved'
  | 'operator-declined'
  | 'expire'
  | 'revoke';

/** Which event may fire from which state. Everything absent here is refused. */
const TRANSITIONS: Readonly<Record<ConsentStatus, Partial<Record<ConsentEventKind, ConsentStatus>>>> = {
  PENDING_SMS: {
    'sms-approved': 'SMS_APPROVED',
    'sms-declined': 'DECLINED',
    expire: 'EXPIRED',
    revoke: 'REVOKED',
  },
  SMS_APPROVED: {
    'operator-requested': 'OPERATOR_PENDING',
    'operator-declined': 'DECLINED',
    expire: 'EXPIRED',
    revoke: 'REVOKED',
  },
  OPERATOR_PENDING: {
    'operator-approved': 'ACTIVE',
    'operator-declined': 'DECLINED',
    expire: 'EXPIRED',
    revoke: 'REVOKED',
  },
  ACTIVE: {
    // No expiry: an active consent ends because somebody ended it, not because
    // a clock ran out quietly while the member believed they were sharing.
    revoke: 'REVOKED',
  },
  DECLINED: {},
  EXPIRED: {},
  REVOKED: {},
};

export interface ConsentTransition {
  from: ConsentStatus;
  to: ConsentStatus;
  trigger: ConsentTrigger;
}

const TRIGGERS: Readonly<Record<ConsentEventKind, ConsentTrigger>> = {
  'sms-approved': 'member-replied',
  'sms-declined': 'member-replied',
  'operator-requested': 'operator-responded',
  'operator-approved': 'operator-responded',
  'operator-declined': 'operator-responded',
  expire: 'expired',
  revoke: 'member-revoked',
};

/**
 * Applies `event` to `from`, or returns null when it is not permitted.
 *
 * Null rather than a thrown error or a silent no-op: callers must decide what
 * an impossible transition means in their context (a retried webhook is
 * routine; an unexpected operator callback deserves a log), and neither should
 * be able to ignore it by accident.
 */
export function applyConsentEvent(
  from: ConsentStatus,
  event: ConsentEventKind,
  trigger?: ConsentTrigger,
): ConsentTransition | null {
  const to = TRANSITIONS[from][event];
  if (!to) return null;
  return { from, to, trigger: trigger ?? TRIGGERS[event] };
}

/**
 * Whether a revocation would change anything.
 *
 * Revoking is special: the spec requires STOP to work "any time", and a member
 * texting STOP must never be told it failed because of what state a system they
 * cannot see happened to be in. Already-terminal states are a no-op, not an
 * error.
 */
export function canRevoke(from: ConsentStatus): boolean {
  return !isTerminal(from);
}
