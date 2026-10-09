/**
 * The consent rules, server side: state machine, SMS keywords, rate limit.
 *
 * **A mirror of three client modules**, duplicated for the reason
 * `shared/types.ts` gives — `functions/` shares no module graph with the app:
 *
 *   src/services/ConsentStateMachine.ts   → TRANSITIONS, applyConsentEvent
 *   src/models/ConsentKeywords.ts         → CONSENT_KEYWORDS, parseConsentReply
 *   src/models/LocateAudit.ts             → isRateLimited and its limits
 *
 * Unlike the other mirrored shapes, drift here would be a security defect: the
 * client predicts the server's answer to show honest UI, and the server is the
 * one that enforces it. So drift is not left to discipline —
 * `src/__tests__/consentParity.test.ts` imports both copies and fails if any
 * state × event, keyword or limit disagrees.
 *
 * Pure: no Firestore, no SDK. Everything that decides whether a person can be
 * located must be testable without an emulator.
 */

export type ConsentStatus =
  | 'PENDING_SMS'
  | 'SMS_APPROVED'
  | 'OPERATOR_PENDING'
  | 'ACTIVE'
  | 'DECLINED'
  | 'EXPIRED'
  | 'REVOKED';

export const CONSENT_STATUSES: readonly ConsentStatus[] = [
  'PENDING_SMS',
  'SMS_APPROVED',
  'OPERATOR_PENDING',
  'ACTIVE',
  'DECLINED',
  'EXPIRED',
  'REVOKED',
];

export type ConsentEventKind =
  | 'sms-approved'
  | 'sms-declined'
  | 'operator-requested'
  | 'operator-approved'
  | 'operator-declined'
  | 'expire'
  | 'revoke';

export const CONSENT_EVENT_KINDS: readonly ConsentEventKind[] = [
  'sms-approved',
  'sms-declined',
  'operator-requested',
  'operator-approved',
  'operator-declined',
  'expire',
  'revoke',
];

export type ConsentTrigger =
  | 'guardian-requested'
  | 'member-replied'
  | 'operator-responded'
  | 'expired'
  | 'member-revoked'
  | 'operator-revoked'
  | 'guardian-removed';

export const TRANSITIONS: Readonly<
  Record<ConsentStatus, Partial<Record<ConsentEventKind, ConsentStatus>>>
> = {
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
    revoke: 'REVOKED',
  },
  DECLINED: {},
  EXPIRED: {},
  REVOKED: {},
};

const TRIGGERS: Readonly<Record<ConsentEventKind, ConsentTrigger>> = {
  'sms-approved': 'member-replied',
  'sms-declined': 'member-replied',
  'operator-requested': 'operator-responded',
  'operator-approved': 'operator-responded',
  'operator-declined': 'operator-responded',
  expire: 'expired',
  revoke: 'member-revoked',
};

export interface ConsentTransition {
  from: ConsentStatus;
  to: ConsentStatus;
  trigger: ConsentTrigger;
}

/** Applies `event` to `from`, or null when it is not permitted. */
export function applyConsentEvent(
  from: ConsentStatus,
  event: ConsentEventKind,
  trigger?: ConsentTrigger,
): ConsentTransition | null {
  const to = TRANSITIONS[from][event];
  if (!to) return null;
  return { from, to, trigger: trigger ?? TRIGGERS[event] };
}

/** The only status that permits a lookup. One greppable place decides it. */
export function allowsLocationLookup(status: ConsentStatus): boolean {
  return status === 'ACTIVE';
}

export function isTerminal(status: ConsentStatus): boolean {
  return status === 'DECLINED' || status === 'EXPIRED' || status === 'REVOKED';
}

// ── Keywords ────────────────────────────────────────────────────────────────

export type ConsentReply = 'approve' | 'decline' | 'stop' | 'unrecognised';

export const CONSENT_KEYWORDS: Readonly<
  Record<Exclude<ConsentReply, 'unrecognised'>, readonly string[]>
> = {
  approve: ['YES', 'Y', 'OK', 'OKAY', 'ACCEPT', 'AGREE', 'हाँ', 'हां', 'HAAN', 'HA', 'JI'],
  decline: ['NO', 'N', 'DECLINE', 'REFUSE', 'नहीं', 'NAHI', 'NAHIN'],
  stop: ['STOP', 'END', 'CANCEL', 'QUIT', 'UNSUBSCRIBE', 'बंद', 'BAND', 'ROKO', 'ROKEN'],
};

/** Strips what phones and people add around a keyword. Shared with member messages. */
export function normalise(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[.!?,;:'"()\[\]]/g, '')
    .replace(/\s+/g, ' ');
}

/** STOP anywhere in the message; approve/decline only as the whole message. */
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

// ── Rate limit ──────────────────────────────────────────────────────────────

export const LOCATE_LIMIT_PER_HOUR = 6;
export const LOCATE_MIN_INTERVAL_MS = 60_000;
const HOUR_MS = 60 * 60 * 1_000;

export function isRateLimited(recentAttemptsAt: Date[], now: Date): boolean {
  const withinHour = recentAttemptsAt.filter(
    (at) => now.getTime() - at.getTime() < HOUR_MS,
  );
  if (withinHour.length >= LOCATE_LIMIT_PER_HOUR) return true;

  const last = withinHour.reduce<Date | null>(
    (latest, at) => (latest === null || at > latest ? at : latest),
    null,
  );
  return last !== null && now.getTime() - last.getTime() < LOCATE_MIN_INTERVAL_MS;
}

/**
 * The attempts worth keeping on the consent document.
 *
 * Only the last hour can ever affect `isRateLimited`, so anything older is
 * dropped on every write — the list is bounded by `LOCATE_LIMIT_PER_HOUR`
 * rather than growing with every lookup a family has ever made.
 */
export function pruneAttempts(attemptsAt: Date[], now: Date): Date[] {
  return attemptsAt.filter((at) => now.getTime() - at.getTime() < HOUR_MS);
}
