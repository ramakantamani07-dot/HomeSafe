import type { MarketCode, SmsTemplate } from './config';

/**
 * Server-side ports for network location (spec §8).
 *
 * These are the credentialled half of the feature, so they live here rather
 * than in `src/providers/` — the app's `NetworkLocationProvider` port calls our
 * `locateMember` function, which is what calls these.
 *
 * Only mock adapters exist. No real operator or SMS adapter is written until G3
 * names the provider, because the spec is explicit: **no invented endpoints**.
 * Each real adapter must be built against that provider's published docs:
 *
 *   Operator  CAMARA Device Location Retrieval — camaraproject/DeviceLocation,
 *             `location-retrieval` API (verify version, path and auth per
 *             aggregator: Vonage, Nokia Network as Code, or operator direct)
 *   Consent   CAMARA / Open Gateway CIBA flow — `bc-authorize` + `token`, per
 *             the aggregator's authorisation docs
 *   SMS       the chosen UK and India providers' send API and inbound webhook
 *             signature scheme; India additionally needs TRAI DLT sender ids
 */

// ── SMS ─────────────────────────────────────────────────────────────────────

export interface OutboundSms {
  to: string;
  market: MarketCode;
  template: SmsTemplate;
  body: string;
  /** TRAI DLT template id; required for India, null elsewhere. */
  dltTemplateId: string | null;
}

/** What a webhook delivered, reduced to what the consent flow needs. */
export interface InboundSms {
  /** The provider's id for this message — the idempotency key. */
  providerMessageId: string;
  from: string;
  body: string;
}

/** The parts of an HTTP request a webhook adapter may read. */
export interface WebhookRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody: Buffer;
  body: unknown;
}

export interface SmsProvider {
  send(sms: OutboundSms): Promise<void>;
  /** Whether the request really came from the provider. Must fail closed. */
  verifyWebhook(req: WebhookRequest): boolean;
  /** Null when the payload is not an inbound text this flow handles. */
  parseInbound(req: WebhookRequest): InboundSms | null;
}

// ── Operator location ───────────────────────────────────────────────────────

export interface OperatorFix {
  latitude: number;
  longitude: number;
  /** The operator's reported radius. Network location is a circle, never a dot. */
  radiusMeters: number;
  observedAt: Date;
}

/**
 * Why an operator lookup failed, in terms a guardian can be told (spec §5:
 * phone off, operator not supported, roaming, timeout).
 */
export type OperatorFailure =
  | 'device-unreachable'
  | 'operator-unsupported'
  | 'roaming'
  | 'timeout'
  | 'unknown';

export class OperatorError extends Error {
  constructor(readonly failure: OperatorFailure, message: string) {
    super(message);
    this.name = 'OperatorError';
  }
}

export interface OperatorLocationProvider {
  /** Throws `OperatorError`. Never called without ACTIVE consent. */
  retrieve(phoneNumber: string, maxAgeSeconds: number): Promise<OperatorFix>;
}

// ── Operator consent (layer 2) ──────────────────────────────────────────────

/**
 * The operator's answer to "may we locate this number?" (spec §4, layer 2).
 *
 * `pending` is a real outcome, not an error: under CIBA the operator contacts
 * the subscriber itself, and the answer arrives later.
 */
export type OperatorConsentOutcome = 'approved' | 'pending' | 'declined';

export interface ConsentStrategy {
  readonly kind: 'CIBA' | 'RECORDED_CONSENT' | 'ACCOUNT_HOLDER';
  request(phoneNumber: string): Promise<OperatorConsentOutcome>;
}

export interface NetworkLocationAdapters {
  sms: SmsProvider;
  operator: OperatorLocationProvider;
  consentStrategyFor(phoneNumber: string): ConsentStrategy;
}
