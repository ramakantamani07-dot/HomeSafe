/**
 * Network-location configuration: markets, the feature flag, SMS wording.
 *
 * Everything here comes from the environment (Firebase loads `functions/.env*`
 * into `process.env`) and is read at call time, not module load, so a test or
 * an emulator run can change it without re-importing.
 */

export type MarketCode = 'GB' | 'IN';

/** The markets this feature is built for (spec §1), keyed by dialling prefix. */
const MARKET_PREFIXES: Readonly<Record<string, MarketCode>> = {
  '+44': 'GB',
  '+91': 'IN',
};

/** The market a number belongs to, or null for anywhere we do not serve. */
export function marketForNumber(e164: string): MarketCode | null {
  const prefix = Object.keys(MARKET_PREFIXES).find((p) => e164.startsWith(p));
  return prefix ? MARKET_PREFIXES[prefix] : null;
}

/**
 * Markets where the feature is switched on: `NETWORK_LOCATION_MARKETS=GB,IN`.
 *
 * **Off by default, everywhere** (Phase 6 exit criterion). Nothing ships until
 * the commercial agreements in G3 exist for that market, and an unset variable
 * must mean "no", never "all".
 */
export function isMarketEnabled(market: MarketCode | null): boolean {
  if (!market) return false;
  return (process.env.NETWORK_LOCATION_MARKETS ?? '')
    .split(',')
    .map((m: string) => m.trim().toUpperCase())
    .includes(market);
}

/** Mirrors `CONSENT_REQUEST_TTL_MS` in `src/models/Consent.ts`. */
export const CONSENT_REQUEST_TTL_MS = 48 * 60 * 60 * 1_000;

/**
 * Resending the consent request (spec §4 step 5: "allow resend with rate
 * limits"). Mirrors `src/models/Consent.ts`; the parity test holds them equal.
 *
 * Generous enough for "they didn't see it", tight enough that a guardian
 * cannot use resend to pester someone who is choosing not to answer — silence
 * is an answer too, and after three resends it is the one we respect.
 */
export const CONSENT_RESEND_MIN_INTERVAL_MS = 60 * 60 * 1_000;
export const CONSENT_RESEND_LIMIT = 3;

/**
 * At most one "they checked your location" text per member per hour (spec §5).
 * Throttled, never disabled: the member must always know they are being found.
 */
export const TRANSPARENCY_NOTICE_INTERVAL_MS = 60 * 60 * 1_000;

/** How stale an operator fix may be and still be worth showing (CAMARA `maxAge`). */
export const LOCATE_MAX_AGE_SECONDS = 60;

/** How long an inbound message id is remembered for webhook de-duplication. */
export const INBOUND_DEDUPE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

// ── SMS ─────────────────────────────────────────────────────────────────────

export type SmsTemplate =
  | 'consent-request'
  | 'consent-active'
  | 'consent-ambiguous'
  | 'consent-help'
  | 'stop-confirmed'
  | 'guardian-stopped'
  | 'transparency';

/**
 * The wording, in one place. Every message a member receives says how to stop
 * — STOP is the one layer of revocation nothing on the guardian's side can
 * block, so it is never more than one text away.
 *
 * English only for now. Hindi templates need a native speaker's review before
 * they are sent to anyone, and India's need DLT registration first anyway.
 */
export function renderSms(template: SmsTemplate, guardianName: string): string {
  switch (template) {
    case 'consent-request':
      return `${guardianName} wants to see your approximate location using wayLoc. Reply YES to allow or NO to refuse. Reply STOP anytime to stop.`;
    case 'consent-active':
      return `wayLoc: ${guardianName} can now see your approximate location when they check. We'll text you when they do, at most once an hour. Reply STOP anytime to stop.`;
    case 'consent-ambiguous':
      return `wayLoc: more than one person has asked to see your location, so we can't tell which you meant. Nothing has been shared. Reply STOP anytime to stop.`;
    case 'consent-help':
      return `wayLoc: reply YES to allow, NO to refuse, or STOP to stop sharing your location.`;
    case 'stop-confirmed':
      return `wayLoc: you've stopped sharing your location. No one can look it up through wayLoc now.`;
    case 'guardian-stopped':
      // Only this guardian: others who asked separately may still be able to,
      // so "no one can" would not be true here the way it is after STOP.
      return `wayLoc: ${guardianName} can no longer see your location through wayLoc. Reply STOP anytime to stop sharing with anyone.`;
    case 'transparency':
      return `${guardianName} checked your approximate location via wayLoc. Reply STOP to stop.`;
  }
}

/**
 * TRAI DLT template id for a message sent in India (spec §7), from
 * `DLT_TEMPLATE_<TEMPLATE>` — e.g. `DLT_TEMPLATE_CONSENT_REQUEST`.
 *
 * Null outside India, and null in India when unregistered — in which case the
 * SMS adapter must refuse to send rather than send unregistered, because Indian
 * carriers silently drop non-DLT traffic and a consent request that vanishes
 * looks, to the guardian, exactly like a member who never replied.
 */
export function dltTemplateId(template: SmsTemplate, market: MarketCode): string | null {
  if (market !== 'IN') return null;
  const key = `DLT_TEMPLATE_${template.toUpperCase().replace(/-/g, '_')}`;
  return process.env[key]?.trim() || null;
}

/** How a guardian is named to the person they are asking to find. */
export function guardianDisplayName(name: string | undefined): string {
  // "Someone" is unhelpful but true; inventing a relationship would not be.
  return name?.trim() || 'Someone';
}
