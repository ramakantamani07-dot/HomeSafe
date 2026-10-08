import { TRANSPARENCY_NOTICE_INTERVAL_MS, type SmsTemplate } from './config';
import {
  allowsLocationLookup,
  isRateLimited,
  isTerminal,
  parseConsentReply,
  type ConsentEventKind,
  type ConsentStatus,
} from './consent';

/**
 * The decisions behind the consent webhook and the locate function, kept pure
 * so every branch is testable without Firestore. The handlers read documents,
 * call these, and write what they say.
 */

// ── Inbound replies ─────────────────────────────────────────────────────────

/** One consent held for the number a reply came from. */
export interface ConsentForReply {
  /** Firestore path — opaque here, only handed back in the plan. */
  path: string;
  status: ConsentStatus;
  expiresAt: Date;
  /** Whether the request text actually reached the provider. */
  requestDelivered: boolean;
}

export interface PlannedTransition {
  path: string;
  event: ConsentEventKind;
  note: string;
}

export interface ReplyPlan {
  transitions: PlannedTransition[];
  /** The one consent to take to the operator after `sms-approved`. */
  approvedPath: string | null;
  /** What to text back, if anything. */
  reply: SmsTemplate | null;
}

/**
 * What a member's text does to the consents held for their number.
 *
 * **STOP revokes everything, for everyone who asked.** It does not matter
 * which guardian's request they are answering or what state each is in — they
 * asked us to stop, and a STOP that left one guardian still able to find them
 * would be the worst possible bug in this feature.
 *
 * **YES approves only when it is unambiguous.** If two people are waiting on
 * this number, a bare YES cannot say which one the member meant, and guessing
 * is not consent. Nothing is approved, and the member is told so. NO, by the
 * same asymmetry as the keywords themselves, declines every waiting request:
 * refusing is allowed to be broad, agreeing is not.
 *
 * A YES can only answer a request that was actually sent. A member whose
 * request never left us (market switched off, send failed) cannot know who is
 * asking, and agreeing to an unnamed stranger is not consent.
 *
 * Unknown numbers get no reply at all (spec §7): a reply would confirm to
 * whoever sent it that the number means something to us.
 *
 * Requests past their deadline are expired here, lazily, rather than by a
 * scheduled job. An expired request can only matter when someone replies to
 * it, and that is exactly when this runs — a cron sweeping for them would
 * spend invocations to change nothing anyone can observe.
 */
export function planReply(
  rawBody: string,
  consents: ConsentForReply[],
  now: Date,
): ReplyPlan {
  const plan: ReplyPlan = { transitions: [], approvedPath: null, reply: null };
  if (consents.length === 0) return plan;

  const reply = parseConsentReply(rawBody);
  const live = consents.filter((c) => !isTerminal(c.status));

  if (reply === 'stop') {
    for (const c of live) {
      plan.transitions.push({ path: c.path, event: 'revoke', note: 'STOP' });
    }
    // Confirmed even when nothing was live: "you've stopped sharing" is true,
    // and a member who texted STOP deserves to hear that it worked.
    plan.reply = 'stop-confirmed';
    return plan;
  }

  const lapsed = live.filter((c) => c.status !== 'ACTIVE' && c.expiresAt <= now);
  for (const c of lapsed) {
    plan.transitions.push({ path: c.path, event: 'expire', note: 'reply after deadline' });
  }
  const pending = live.filter((c) => c.status === 'PENDING_SMS' && !lapsed.includes(c));
  const waiting = pending.filter((c) => c.requestDelivered);

  switch (reply) {
    case 'approve':
      if (waiting.length === 1) {
        plan.transitions.push({ path: waiting[0].path, event: 'sms-approved', note: 'YES' });
        plan.approvedPath = waiting[0].path;
      } else if (waiting.length > 1) {
        plan.reply = 'consent-ambiguous';
      }
      break;
    case 'decline': {
      // Every waiting request, delivered or not: refusing needs no context.
      for (const c of pending) {
        plan.transitions.push({ path: c.path, event: 'sms-declined', note: 'NO' });
      }
      // A NO after the request was answered is not a late reply to it — it is
      // someone who no longer wants to be found, saying so in the word they
      // reached for. Reading it as anything less than STOP would put the
      // keyword list ahead of the person.
      const answered = live.filter((c) => !pending.includes(c) && !lapsed.includes(c));
      for (const c of answered) {
        plan.transitions.push({ path: c.path, event: 'revoke', note: 'NO after approval' });
      }
      if (answered.length > 0) plan.reply = 'stop-confirmed';
      break;
    }
    case 'unrecognised':
      if (waiting.length > 0) plan.reply = 'consent-help';
      break;
  }
  return plan;
}

// ── Locate ──────────────────────────────────────────────────────────────────

export type LocateReason = 'manual' | 'sos' | 'geofence';

export type LocateDenial = 'denied-not-guardian' | 'denied-no-consent' | 'denied-rate-limited';

export interface LocateGateInput {
  /** Whether the caller holds this member — guardianship is ownership. */
  isGuardian: boolean;
  /** Null when no consent record exists. */
  consentStatus: ConsentStatus | null;
  recentLookupsAt: Date[];
  reason: LocateReason;
  now: Date;
}

/**
 * Whether a lookup may go ahead, checked in the spec's order (§5): guardian,
 * then consent, then rate limit. The order matters for what the audit records
 * — a stranger is refused as a stranger, not as someone without consent.
 *
 * SOS bypasses the rate limit and nothing else (spec §7): someone asking for
 * help must not be refused because they were checked on a minute ago, but an
 * SOS from a member who has withdrawn consent still locates no one.
 */
export function gateLocate(input: LocateGateInput): LocateDenial | null {
  if (!input.isGuardian) return 'denied-not-guardian';
  if (!input.consentStatus || !allowsLocationLookup(input.consentStatus)) {
    return 'denied-no-consent';
  }
  if (input.reason !== 'sos' && isRateLimited(input.recentLookupsAt, input.now)) {
    return 'denied-rate-limited';
  }
  return null;
}

/** Whether a successful lookup should text the member (spec §5's throttle). */
export function shouldSendTransparencyNotice(lastNoticeAt: Date | null, now: Date): boolean {
  return (
    lastNoticeAt === null ||
    now.getTime() - lastNoticeAt.getTime() >= TRANSPARENCY_NOTICE_INTERVAL_MS
  );
}

// ── Revocation side effects (layer 3) ───────────────────────────────────────

export interface RevocationPlan {
  /** Write the audit event — only when no server path has already. */
  writeEvent: boolean;
  /** What to text the member, if anything. */
  notify: SmsTemplate | null;
}

/**
 * What follows a consent reaching REVOKED, whoever got it there.
 *
 * `revokedBy` absent means the guardian's device wrote it (see
 * `StoredConsent.revokedBy`). That is the one path where no event exists yet,
 * because the server did not make the change.
 *
 * The member is told unless they did it themselves — the STOP webhook has
 * already confirmed that — and only if they were ever told about the request.
 * Texting someone "X can no longer see your location" about a request that
 * never reached them would be the first they had heard of it, and alarming for
 * no reason.
 */
export function planRevocation(
  revokedBy: string | undefined,
  requestDelivered: boolean,
): RevocationPlan {
  return {
    writeEvent: revokedBy === undefined,
    notify: revokedBy !== 'member-revoked' && requestDelivered ? 'guardian-stopped' : null,
  };
}
