/**
 * Consent for locating a basic-phone member (network-location spec §4).
 *
 * The single most important model in this feature. Everything else — lookups,
 * geofences, SOS responses — is gated on reaching `ACTIVE`, and nothing may
 * route around it.
 *
 * Two layers, because one is not enough to be honest:
 *  - **Layer 1** is the person themselves, by SMS reply. It is what makes this
 *    consent rather than surveillance.
 *  - **Layer 2** is their operator, who must also authorise the lookup.
 *
 * Both have to succeed. A member who replied YES but whose operator has not
 * authorised is `OPERATOR_PENDING`, and must not be locatable — the spec is
 * explicit that only `ACTIVE` allows lookups.
 */
export type ConsentStatus =
  | 'PENDING_SMS'
  | 'SMS_APPROVED'
  | 'OPERATOR_PENDING'
  | 'ACTIVE'
  | 'DECLINED'
  | 'EXPIRED'
  | 'REVOKED';

/** States from which no further progress is possible without starting again. */
export const TERMINAL_CONSENT_STATUSES: readonly ConsentStatus[] = [
  'DECLINED',
  'EXPIRED',
  'REVOKED',
];

/**
 * The only status that permits a location lookup.
 *
 * A named predicate rather than `=== 'ACTIVE'` scattered through the codebase:
 * there must be exactly one place that decides what "allowed to locate someone"
 * means, and it must be greppable.
 */
export function allowsLocationLookup(status: ConsentStatus): boolean {
  return status === 'ACTIVE';
}

export function isTerminal(status: ConsentStatus): boolean {
  return TERMINAL_CONSENT_STATUSES.includes(status);
}

/**
 * What caused a transition. Stored on every event so an audit can answer "who
 * decided this?", which is the question that matters when someone asks why
 * their location was shared.
 */
export type ConsentTrigger =
  | 'guardian-requested'
  | 'member-replied'
  | 'operator-responded'
  | 'expired'
  | 'member-revoked'
  | 'operator-revoked'
  | 'guardian-removed';

export interface Consent {
  /** The basic-phone member this consent is about. */
  memberId: string;
  status: ConsentStatus;
  /** E.164. The number consent was granted for — re-pairing a new SIM needs new consent. */
  phoneNumber: string;
  requestedAt: Date;
  /** When the SMS request lapses if unanswered. */
  expiresAt: Date;
  /** When ACTIVE was reached. Null until then. */
  activatedAt: Date | null;
  updatedAt: Date;
  /**
   * Whether the request text reached the member, as the server last reported.
   * Null until the server has picked the request up.
   */
  requestDelivery: ConsentRequestDelivery | null;
}

/**
 * What happened to the consent-request text (server-written). The difference
 * between "waiting for their reply" and "we couldn't text them" is the
 * difference between a person who hasn't decided and one who doesn't know.
 */
export type ConsentRequestDelivery = 'sending' | 'sent' | 'failed' | 'unavailable';

/**
 * One transition, append-only (spec §4: "Every transition is stored… audit
 * trail"). Never updated and never deleted — a consent history that can be
 * rewritten is not evidence of anything.
 */
export interface ConsentEvent {
  id: string;
  memberId: string;
  from: ConsentStatus | null;
  to: ConsentStatus;
  trigger: ConsentTrigger;
  /** Free-form detail: the SMS keyword matched, the operator's reason. */
  note: string | null;
  at: Date;
}

/** How long an unanswered SMS request stands. Spec's default, configurable. */
export const CONSENT_REQUEST_TTL_MS = 48 * 60 * 60 * 1_000;

/**
 * Resending the request: at most once an hour, three times in all. Mirrors the
 * server (`functions/src/networkLocation/config.ts`), held equal by the parity
 * test. Past that, silence is the member's answer.
 */
export const CONSENT_RESEND_MIN_INTERVAL_MS = 60 * 60 * 1_000;
export const CONSENT_RESEND_LIMIT = 3;

/** What happened when the guardian tapped "Resend consent text". */
export type ResendOutcome =
  | 'sent'
  | 'not-sent'
  | 'too-soon'
  | 'limit-reached'
  | 'not-pending'
  | 'failed';
