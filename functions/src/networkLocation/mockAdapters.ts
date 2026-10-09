import { createHmac, timingSafeEqual } from 'crypto';
import * as logger from 'firebase-functions/logger';

import type {
  ConsentStrategy,
  InboundCall,
  InboundSms,
  NetworkLocationAdapters,
  OperatorConsentOutcome,
  OperatorFailure,
  OperatorFix,
  OperatorLocationProvider,
  OutboundSms,
  SmsProvider,
  WebhookRequest,
} from './ports';
import { OperatorError } from './ports';

/**
 * Mock adapters, so the whole consent → find → STOP flow runs in the emulator
 * and in tests before any commercial agreement exists (G3).
 *
 * They are only ever selected explicitly — see `adapters.ts`. A deployed
 * function with no real adapter configured refuses to work rather than falling
 * back to these, because a mock that "sends" a consent SMS nobody receives
 * would leave a guardian waiting on a reply that can never come.
 */

/** The header the mock webhook signs with: hex HMAC-SHA256 of the raw body. */
export const MOCK_SIGNATURE_HEADER = 'x-wayloc-signature';

export function signMockWebhook(rawBody: string | Buffer, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

/** Bounded, so a long emulator session cannot grow it without limit. */
const OUTBOX_LIMIT = 100;

export class MockSmsProvider implements SmsProvider {
  readonly outbox: OutboundSms[] = [];

  constructor(private readonly webhookSecret: string | undefined) {}

  async send(sms: OutboundSms): Promise<void> {
    if (sms.market === 'IN' && !sms.dltTemplateId) {
      // The real adapter must refuse this too — see `dltTemplateId`.
      throw new Error(`No DLT template registered for ${sms.template}`);
    }
    this.outbox.push(sms);
    if (this.outbox.length > OUTBOX_LIMIT) this.outbox.shift();
    // Template and market only: the number and the body would both be PII.
    logger.info('Mock SMS sent', { template: sms.template, market: sms.market });
  }

  verifyWebhook(req: WebhookRequest): boolean {
    if (!this.webhookSecret) return false;
    const given = req.headers[MOCK_SIGNATURE_HEADER];
    if (typeof given !== 'string') return false;

    const expected = Buffer.from(signMockWebhook(req.rawBody, this.webhookSecret), 'hex');
    const actual = Buffer.from(given, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  parseInbound(req: WebhookRequest): InboundSms | null {
    const b = req.body as { messageId?: unknown; from?: unknown; body?: unknown } | null;
    if (!b || typeof b.messageId !== 'string' || typeof b.from !== 'string') return null;
    return {
      providerMessageId: b.messageId,
      from: b.from,
      body: typeof b.body === 'string' ? b.body : '',
    };
  }

  parseInboundCall(req: WebhookRequest): InboundCall | null {
    const b = req.body as { callId?: unknown; from?: unknown } | null;
    if (!b || typeof b.callId !== 'string' || typeof b.from !== 'string') return null;
    return { providerCallId: b.callId, from: b.from };
  }
}

/** Mirrors `MockNetworkLocationProvider`: coarse on purpose (decision D16). */
const MOCK_RADIUS_METERS = 650;

export class MockOperatorLocationProvider implements OperatorLocationProvider {
  private readonly failures = new Map<string, OperatorFailure>();

  /** Test seam: makes lookups for `phoneNumber` fail as `failure`. */
  failFor(phoneNumber: string, failure: OperatorFailure): void {
    this.failures.set(phoneNumber, failure);
  }

  async retrieve(phoneNumber: string, _maxAgeSeconds: number): Promise<OperatorFix> {
    const failure = this.failures.get(phoneNumber);
    if (failure) throw new OperatorError(failure, `Mock operator failure: ${failure}`);

    const seed = [...phoneNumber].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return {
      latitude: 51.5 + ((seed % 100) - 50) / 2_000,
      longitude: -0.12 + ((seed % 73) - 36) / 2_000,
      radiusMeters: MOCK_RADIUS_METERS,
      observedAt: new Date(),
    };
  }

  /** Inside when the mock fix's centre is within the zone — same stable position as `retrieve`. */
  async verify(
    phoneNumber: string,
    centre: { latitude: number; longitude: number },
    radiusMeters: number,
  ): Promise<boolean> {
    const fix = await this.retrieve(phoneNumber, 0);
    const dLat = (fix.latitude - centre.latitude) * 111_000;
    const dLon = (fix.longitude - centre.longitude) * 111_000 * Math.cos((centre.latitude * Math.PI) / 180);
    return Math.sqrt(dLat * dLat + dLon * dLon) <= radiusMeters;
  }
}

/** Behaves as an operator that accepts our recorded (layer 1) consent. */
export class MockConsentStrategy implements ConsentStrategy {
  readonly kind = 'RECORDED_CONSENT' as const;

  constructor(private readonly outcome: OperatorConsentOutcome = 'approved') {}

  async request(_phoneNumber: string): Promise<OperatorConsentOutcome> {
    return this.outcome;
  }
}

export function createMockAdapters(webhookSecret: string | undefined): NetworkLocationAdapters {
  const strategy = new MockConsentStrategy();
  return {
    sms: new MockSmsProvider(webhookSecret),
    operator: new MockOperatorLocationProvider(),
    consentStrategyFor: () => strategy,
  };
}
