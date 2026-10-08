import type { ConsentRequestDelivery, ConsentStatus } from './Consent';

/**
 * Someone in the circle who has no smartphone and no wayLoc account
 * (network-location spec §3).
 *
 * **Deliberately not a `FamilyMember`.** That model is a two-sided connection
 * between two accounts: both parties signed in, both can revoke, both have a
 * device reporting GPS. A basic-phone member has none of that — there is no
 * account to connect to, their consent arrives by SMS, and their location comes
 * from an operator rather than a handset. Forcing one storage model to serve
 * both would weaken the guarantees on the app side and invent guarantees that
 * do not exist on this one.
 *
 * The UI still shows one list; `CircleMember` is the view-model that unifies
 * them. Storage stays honest about the difference.
 */
export interface BasicPhoneMember {
  id: string;
  /** The guardian who added them and may locate them. */
  ownerId: string;
  displayName: string;
  /** E.164. Identity here — consent is granted for this number specifically. */
  phoneNumber: string;
  /** Network operator, when a lookup has identified one. Null until then. */
  operator: string | null;
  /** Mirrors the consent record, so the circle list need not read two documents. */
  consentStatus: ConsentStatus;
  /** The guardian said this person is under 18 (Option 15 S4). */
  minor: boolean;
  /**
   * When the guardian confirmed they are a minor's parent or legal guardian —
   * the parental-consent evidence the spec asks for (§4 step 2). Null for an
   * adult, who consents for themselves by text.
   */
  guardianAttestedAt: Date | null;
  createdAt: Date;
}

/** What a guardian supplies to add someone. Validated before it is stored. */
export interface NewBasicPhoneMember {
  displayName: string;
  /** Already normalised by `normaliseMemberNumber`. */
  phoneNumber: string;
  minor: boolean;
  /** Required true when `minor` — `canSendRequest` enforces it. */
  guardianAttested: boolean;
}

/** The markets network location is built for (spec §1). Mirrors the server's. */
export type MemberMarket = 'GB' | 'IN';

export const MEMBER_MARKET_LABEL: Readonly<Record<MemberMarket, string>> = {
  GB: 'UK mobile',
  IN: 'Indian mobile',
};

/**
 * A typed number as E.164, if it is a mobile in a market we serve.
 *
 * Mobiles only, because only a SIM can be located by its network — a landline
 * would pass validation and then fail at the first Find, after the member had
 * already been texted. Accepts what people actually type: spaces, a leading
 * national 0, or the country code without its plus.
 *
 * Deliberately narrow rather than general. Full parsing is `libphonenumber-js`,
 * which Phase 7 adds for sign-in; until then this covers exactly the two
 * markets the feature exists in and refuses everything else, which is the
 * honest answer for a country we cannot locate anyone in anyway.
 */
export function normaliseMemberNumber(
  raw: string,
): { e164: string; market: MemberMarket } | null {
  const digits = raw.replace(/[\s\-().]/g, '');

  const uk = digits.match(/^(?:\+44|0044|44|0)(7\d{9})$/);
  if (uk) return { e164: `+44${uk[1]}`, market: 'GB' };

  const india = digits.match(/^(?:\+91|0091|91|0)?([6-9]\d{9})$/);
  if (india) return { e164: `+91${india[1]}`, market: 'IN' };

  return null;
}

/** Whether Add someone's "Send request" may be pressed. */
export function canSendRequest(input: {
  displayName: string;
  phoneNumber: string;
  minor: boolean;
  guardianAttested: boolean;
}): boolean {
  if (!input.displayName.trim()) return false;
  if (!normaliseMemberNumber(input.phoneNumber)) return false;
  return !input.minor || input.guardianAttested;
}

/**
 * One list for the circle, two storage models behind it.
 *
 * Screens render this; nothing in the UI branches on which kind it came from
 * beyond the badge, which is exactly the point — a guardian thinks about
 * "people", not "account-holders and SMS-consented numbers".
 */
export interface CircleMember {
  id: string;
  displayName: string;
  kind: 'app' | 'basic';
  /** Status line shown under the name. Already resolved to something sayable. */
  status: string;
  /** Only basic-phone members have one; app members manage sharing themselves. */
  consentStatus: ConsentStatus | null;
}

/**
 * How a basic-phone member's state reads in the circle list.
 *
 * Never reassuring about something we cannot know. A member whose consent is
 * pending is not "offline" — they simply have not answered, and saying anything
 * else would misrepresent a person who has made no decision yet.
 */
export function describeConsentStatus(
  status: ConsentStatus,
  delivery: ConsentRequestDelivery | null = null,
): string {
  switch (status) {
    case 'PENDING_SMS':
      // "Waiting for their reply" would be untrue of someone who was never
      // texted: they are not deciding, they do not know.
      if (delivery === 'failed' || delivery === 'unavailable') return "We couldn't text them";
      return 'Waiting for their reply';
    case 'SMS_APPROVED':
    case 'OPERATOR_PENDING':
      return 'Setting up with their network';
    case 'ACTIVE':
      return 'Can be found';
    case 'DECLINED':
      return 'They said no';
    case 'EXPIRED':
      return "They didn't reply";
    case 'REVOKED':
      return 'They stopped sharing';
    default:
      return 'Not sharing';
  }
}
