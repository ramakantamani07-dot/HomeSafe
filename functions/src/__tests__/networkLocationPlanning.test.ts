/**
 * The decisions behind the consent webhook and `locateMember`. Pure, so the
 * cases that matter most — STOP, ambiguity, refusals — are proven here without
 * an emulator.
 */
import { isMarketEnabled, marketForNumber, dltTemplateId } from '../networkLocation/config';
import { MockSmsProvider, signMockWebhook, MOCK_SIGNATURE_HEADER } from '../networkLocation/mockAdapters';
import {
  gateLocate,
  gateResend,
  planReply,
  planRevocation,
  shouldSendTransparencyNotice,
  type ConsentForReply,
} from '../networkLocation/planning';
import type { ConsentStatus } from '../networkLocation/consent';

const now = new Date('2026-10-07T12:00:00Z');
const later = new Date(now.getTime() + 60 * 60_000);
const earlier = new Date(now.getTime() - 60_000);

function consent(
  path: string,
  status: ConsentStatus,
  opts: { expiresAt?: Date; delivered?: boolean } = {},
): ConsentForReply {
  return {
    path,
    status,
    expiresAt: opts.expiresAt ?? later,
    requestDelivered: opts.delivered ?? true,
  };
}

describe('planReply — STOP', () => {
  it('revokes every live consent for the number, whoever asked and whatever state', () => {
    const plan = planReply(
      'please stop',
      [
        consent('a', 'ACTIVE'),
        consent('b', 'PENDING_SMS'),
        consent('c', 'OPERATOR_PENDING'),
        consent('d', 'DECLINED'),
      ],
      now,
    );
    expect(plan.transitions).toEqual([
      { path: 'a', event: 'revoke', note: 'STOP' },
      { path: 'b', event: 'revoke', note: 'STOP' },
      { path: 'c', event: 'revoke', note: 'STOP' },
    ]);
    expect(plan.reply).toBe('stop-confirmed');
    expect(plan.approvedPath).toBeNull();
  });

  it('revokes even a request past its deadline — the member said stop', () => {
    const plan = planReply('STOP', [consent('a', 'PENDING_SMS', { expiresAt: earlier })], now);
    expect(plan.transitions).toEqual([{ path: 'a', event: 'revoke', note: 'STOP' }]);
  });

  it('beats an approval in the same message', () => {
    const plan = planReply('yes stop', [consent('a', 'PENDING_SMS')], now);
    expect(plan.transitions.map((t) => t.event)).toEqual(['revoke']);
    expect(plan.approvedPath).toBeNull();
  });
});

describe('planReply — YES', () => {
  it('approves the single waiting request', () => {
    const plan = planReply('Yes!', [consent('a', 'PENDING_SMS'), consent('b', 'REVOKED')], now);
    expect(plan.transitions).toEqual([{ path: 'a', event: 'sms-approved', note: 'YES' }]);
    expect(plan.approvedPath).toBe('a');
    expect(plan.reply).toBeNull();
  });

  it('approves nothing when two people are waiting, and says so', () => {
    const plan = planReply('YES', [consent('a', 'PENDING_SMS'), consent('b', 'PENDING_SMS')], now);
    expect(plan.transitions).toEqual([]);
    expect(plan.approvedPath).toBeNull();
    expect(plan.reply).toBe('consent-ambiguous');
  });

  it('cannot answer a request that was never delivered', () => {
    const plan = planReply('YES', [consent('a', 'PENDING_SMS', { delivered: false })], now);
    expect(plan.approvedPath).toBeNull();
    expect(plan.transitions).toEqual([]);
  });

  it('expires a lapsed request instead of approving it', () => {
    const plan = planReply('YES', [consent('a', 'PENDING_SMS', { expiresAt: earlier })], now);
    expect(plan.transitions).toEqual([{ path: 'a', event: 'expire', note: 'reply after deadline' }]);
    expect(plan.approvedPath).toBeNull();
  });

  it('does nothing to a consent that is already active', () => {
    const plan = planReply('YES', [consent('a', 'ACTIVE')], now);
    expect(plan.transitions).toEqual([]);
  });

  it('is not consent when it is a sentence', () => {
    const plan = planReply('yes if you must', [consent('a', 'PENDING_SMS')], now);
    expect(plan.approvedPath).toBeNull();
    expect(plan.reply).toBe('consent-help');
  });
});

describe('planReply — NO', () => {
  it('declines every waiting request, delivered or not', () => {
    const plan = planReply(
      'no',
      [consent('a', 'PENDING_SMS'), consent('b', 'PENDING_SMS', { delivered: false })],
      now,
    );
    expect(plan.transitions.map((t) => [t.path, t.event])).toEqual([
      ['a', 'sms-declined'],
      ['b', 'sms-declined'],
    ]);
  });

  it('after approval, is read as stop', () => {
    const plan = planReply('NO', [consent('a', 'ACTIVE'), consent('b', 'SMS_APPROVED')], now);
    expect(plan.transitions.map((t) => [t.path, t.event])).toEqual([
      ['a', 'revoke'],
      ['b', 'revoke'],
    ]);
    expect(plan.reply).toBe('stop-confirmed');
  });
});

describe('planReply — unknown numbers', () => {
  it('neither changes nor replies to anything', () => {
    for (const body of ['STOP', 'YES', 'NO', 'hello']) {
      expect(planReply(body, [], now)).toEqual({ transitions: [], approvedPath: null, reply: null });
    }
  });
});

describe('gateLocate', () => {
  const base = {
    isGuardian: true,
    consentStatus: 'ACTIVE' as ConsentStatus,
    recentLookupsAt: [] as Date[],
    reason: 'manual' as const,
    now,
  };

  it('allows a guardian with active consent and no recent lookups', () => {
    expect(gateLocate(base)).toBeNull();
  });

  it('refuses a stranger as a stranger, before looking at consent', () => {
    expect(gateLocate({ ...base, isGuardian: false })).toBe('denied-not-guardian');
    expect(gateLocate({ ...base, isGuardian: false, consentStatus: null })).toBe('denied-not-guardian');
  });

  it('refuses every status but ACTIVE', () => {
    const others: (ConsentStatus | null)[] = [
      null, 'PENDING_SMS', 'SMS_APPROVED', 'OPERATOR_PENDING', 'DECLINED', 'EXPIRED', 'REVOKED',
    ];
    for (const consentStatus of others) {
      expect(gateLocate({ ...base, consentStatus })).toBe('denied-no-consent');
    }
  });

  it('rate-limits manual and geofence lookups', () => {
    const recentLookupsAt = [new Date(now.getTime() - 30_000)];
    expect(gateLocate({ ...base, recentLookupsAt })).toBe('denied-rate-limited');
    expect(gateLocate({ ...base, recentLookupsAt, reason: 'geofence' })).toBe('denied-rate-limited');
  });

  it('lets SOS past the rate limit, and past nothing else', () => {
    const recentLookupsAt = [new Date(now.getTime() - 30_000)];
    expect(gateLocate({ ...base, recentLookupsAt, reason: 'sos' })).toBeNull();
    expect(gateLocate({ ...base, reason: 'sos', consentStatus: 'REVOKED' })).toBe('denied-no-consent');
    expect(gateLocate({ ...base, reason: 'sos', isGuardian: false })).toBe('denied-not-guardian');
  });
});

describe('shouldSendTransparencyNotice', () => {
  it('sends the first, then at most one an hour', () => {
    expect(shouldSendTransparencyNotice(null, now)).toBe(true);
    expect(shouldSendTransparencyNotice(new Date(now.getTime() - 59 * 60_000), now)).toBe(false);
    expect(shouldSendTransparencyNotice(new Date(now.getTime() - 60 * 60_000), now)).toBe(true);
  });
});

describe('markets and the feature flag', () => {
  const original = process.env.NETWORK_LOCATION_MARKETS;
  afterEach(() => {
    process.env.NETWORK_LOCATION_MARKETS = original;
    delete process.env.DLT_TEMPLATE_CONSENT_REQUEST;
  });

  it('resolves the two markets by prefix and nothing else', () => {
    expect(marketForNumber('+447700900123')).toBe('GB');
    expect(marketForNumber('+919876543210')).toBe('IN');
    expect(marketForNumber('+15555550100')).toBeNull();
  });

  it('is off everywhere when unset', () => {
    delete process.env.NETWORK_LOCATION_MARKETS;
    expect(isMarketEnabled('GB')).toBe(false);
    expect(isMarketEnabled('IN')).toBe(false);
  });

  it('is on only for the markets named', () => {
    process.env.NETWORK_LOCATION_MARKETS = ' gb ';
    expect(isMarketEnabled('GB')).toBe(true);
    expect(isMarketEnabled('IN')).toBe(false);
    expect(isMarketEnabled(null)).toBe(false);
  });

  it('reads DLT template ids for India only', () => {
    process.env.DLT_TEMPLATE_CONSENT_REQUEST = '1107160000000000001';
    expect(dltTemplateId('consent-request', 'IN')).toBe('1107160000000000001');
    expect(dltTemplateId('consent-request', 'GB')).toBeNull();
    expect(dltTemplateId('transparency', 'IN')).toBeNull();
  });
});

describe('MockSmsProvider', () => {
  const secret = 'test-secret';
  const raw = Buffer.from(JSON.stringify({ messageId: 'm1', from: '+447700900123', body: 'STOP' }));
  const request = (signature: string | undefined) => ({
    headers: { [MOCK_SIGNATURE_HEADER]: signature },
    rawBody: raw,
    body: JSON.parse(raw.toString()),
  });

  it('accepts a correctly signed webhook', () => {
    expect(new MockSmsProvider(secret).verifyWebhook(request(signMockWebhook(raw, secret)))).toBe(true);
  });

  it('fails closed: wrong signature, missing signature, or no secret configured', () => {
    expect(new MockSmsProvider(secret).verifyWebhook(request(signMockWebhook(raw, 'other')))).toBe(false);
    expect(new MockSmsProvider(secret).verifyWebhook(request(undefined))).toBe(false);
    expect(new MockSmsProvider(undefined).verifyWebhook(request(signMockWebhook(raw, secret)))).toBe(false);
  });

  it('refuses to send in India without a DLT template', async () => {
    const sms = new MockSmsProvider(secret);
    await expect(
      sms.send({ to: '+919876543210', market: 'IN', template: 'transparency', body: 'x', dltTemplateId: null }),
    ).rejects.toThrow(/DLT/);
    expect(sms.outbox).toHaveLength(0);
  });
});

describe('planRevocation', () => {
  it("writes the event only for the guardian's own client write", () => {
    expect(planRevocation(undefined, true).writeEvent).toBe(true);
    expect(planRevocation('member-revoked', true).writeEvent).toBe(false);
    expect(planRevocation('guardian-removed', true).writeEvent).toBe(false);
  });

  it('does not text a member who stopped it themselves — STOP already confirmed', () => {
    expect(planRevocation('member-revoked', true).notify).toBeNull();
  });

  it('tells the member when the guardian stopped, if they were ever asked', () => {
    expect(planRevocation(undefined, true).notify).toBe('guardian-stopped');
    expect(planRevocation('guardian-removed', true).notify).toBe('guardian-stopped');
    expect(planRevocation(undefined, false).notify).toBeNull();
  });
});

describe('gateResend', () => {
  const now = new Date('2026-10-08T12:00:00Z');
  const ago = (min: number) => new Date(now.getTime() - min * 60_000);

  it('resends a waiting request', () => {
    expect(gateResend('PENDING_SMS', [], now)).toBeNull();
    expect(gateResend('PENDING_SMS', [ago(61)], now)).toBeNull();
  });

  it('never resends once someone has answered or stopped it', () => {
    for (const s of ['SMS_APPROVED', 'OPERATOR_PENDING', 'ACTIVE', 'DECLINED', 'EXPIRED', 'REVOKED'] as const) {
      expect(gateResend(s, [], now)).toBe('not-pending');
    }
  });

  it('waits an hour between resends, and stops after three', () => {
    expect(gateResend('PENDING_SMS', [ago(30)], now)).toBe('too-soon');
    expect(gateResend('PENDING_SMS', [ago(300), ago(200), ago(100)], now)).toBe('limit-reached');
  });
});
