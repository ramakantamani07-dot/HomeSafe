import {
  canSendRequest,
  describeConsentStatus,
  normaliseMemberNumber,
} from '../models/BasicPhoneMember';
import { LOCATE_LIMIT_PER_HOUR, nextLookupAllowedAt, countsTowardLimit } from '../models/LocateAudit';
import { regionForArea } from '../models/MapModels';
import { describeFindFailure, describeRadius, minutesUntil } from '../components/circle/findCopy';
import { MockBasicPhoneMemberProvider } from '../implementations/networkLocation/MockBasicPhoneMemberProvider';
import { MockNetworkLocationProvider } from '../implementations/networkLocation/MockNetworkLocationProvider';
import { NetworkLocationError } from '../providers/NetworkLocationProvider';

describe('normaliseMemberNumber', () => {
  it('reads UK mobiles however they are typed', () => {
    for (const raw of ['07700 900123', '+44 7700 900123', '447700900123', '0044 7700-900123']) {
      expect(normaliseMemberNumber(raw)).toEqual({ e164: '+447700900123', market: 'GB' });
    }
  });

  it('reads Indian mobiles however they are typed', () => {
    for (const raw of ['98765 43210', '+91 98765 43210', '09876543210', '919876543210']) {
      expect(normaliseMemberNumber(raw)).toEqual({ e164: '+919876543210', market: 'IN' });
    }
  });

  it('refuses landlines and other countries — a number that cannot be located', () => {
    for (const raw of ['020 7946 0000', '+1 555 555 0100', '12345', '+44 1604 123456', '']) {
      expect(normaliseMemberNumber(raw)).toBeNull();
    }
  });
});

describe('canSendRequest', () => {
  const adult = { displayName: 'Nani', phoneNumber: '07700900123', minor: false, guardianAttested: false };

  it('needs a name and a number we can locate', () => {
    expect(canSendRequest(adult)).toBe(true);
    expect(canSendRequest({ ...adult, displayName: '  ' })).toBe(false);
    expect(canSendRequest({ ...adult, phoneNumber: '020 7946 0000' })).toBe(false);
  });

  it('needs the guardian tick for someone under 18, and only then', () => {
    expect(canSendRequest({ ...adult, minor: true })).toBe(false);
    expect(canSendRequest({ ...adult, minor: true, guardianAttested: true })).toBe(true);
  });
});

describe('describeConsentStatus', () => {
  it('does not say "waiting for their reply" about someone who was never texted', () => {
    expect(describeConsentStatus('PENDING_SMS', 'sent')).toBe('Waiting for their reply');
    expect(describeConsentStatus('PENDING_SMS', 'failed')).toBe("We couldn't text them");
    expect(describeConsentStatus('PENDING_SMS', 'unavailable')).toBe("We couldn't text them");
  });
});

describe('nextLookupAllowedAt', () => {
  const now = new Date('2026-10-08T12:00:00Z');
  const ago = (min: number) => new Date(now.getTime() - min * 60_000);

  it('is null when Find is allowed', () => {
    expect(nextLookupAllowedAt([], now)).toBeNull();
    expect(nextLookupAllowedAt([ago(2)], now)).toBeNull();
  });

  it('waits out the one-minute gap', () => {
    expect(nextLookupAllowedAt([ago(0.5)], now)).toEqual(new Date(now.getTime() + 30_000));
  });

  it('at the hourly cap, waits for the oldest find to age out', () => {
    const six = Array.from({ length: LOCATE_LIMIT_PER_HOUR }, (_, i) => ago(50 - i * 5));
    expect(nextLookupAllowedAt(six, now)).toEqual(new Date(now.getTime() + 10 * 60_000));
  });

  it('counts a find that reached the operator, not one refused before it', () => {
    expect(countsTowardLimit('success')).toBe(true);
    expect(countsTowardLimit('provider-error')).toBe(true);
    expect(countsTowardLimit('denied-no-consent')).toBe(false);
    expect(countsTowardLimit('denied-rate-limited')).toBe(false);
  });
});

describe('find result wording', () => {
  it('frames the whole circle with its edge in view', () => {
    const r = regionForArea({ id: 'a', centre: { latitude: 51.5, longitude: -0.1 }, radiusMeters: 800 });
    expect(r.latitudeDelta * 111_000).toBeGreaterThan(1_600);
  });

  it('rounds minutes up and never says zero', () => {
    const now = new Date(0);
    expect(minutesUntil(new Date(10_000), now)).toBe(1);
    expect(minutesUntil(new Date(7.2 * 60_000), now)).toBe(8);
  });

  it('writes a radius the way the boards do', () => {
    expect(describeRadius(812)).toBe('within 800 m');
    expect(describeRadius(1_240)).toBe('within 1.2 km');
  });

  it('never reassures about a phone the network cannot reach', () => {
    const { title, body } = describeFindFailure('device-unreachable', 'Sam');
    expect(`${title} ${body}`).not.toMatch(/safe|home|fine/i);
  });
});

describe('mock basic-phone finding', () => {
  function setup() {
    const members = new MockBasicPhoneMemberProvider(null);
    return { members, network: new MockNetworkLocationProvider(members) };
  }
  const input = { displayName: 'Sam', phoneNumber: '+447700900123', minor: true, guardianAttested: true };

  it('refuses before YES, finds after, and records both', async () => {
    const { members, network } = setup();
    const sam = await members.addMember('me', input);

    await expect(network.retrieve(sam.id, 'manual')).rejects.toMatchObject({ failure: 'no-consent' });
    members.simulateReply(sam.id, 'ACTIVE');
    const fix = await network.retrieve(sam.id, 'manual');
    expect(fix.accuracyMeters).toBeGreaterThanOrEqual(500);

    const finds = await members.listFinds('me', sam.id, 10);
    expect(finds.map((f) => f.outcome)).toEqual(['success', 'denied-no-consent']);
  });

  it('rate-limits a second find, and lets SOS through', async () => {
    const { members, network } = setup();
    const sam = await members.addMember('me', input);
    members.simulateReply(sam.id, 'ACTIVE');
    await network.retrieve(sam.id, 'manual');

    await expect(network.retrieve(sam.id, 'manual')).rejects.toBeInstanceOf(NetworkLocationError);
    await expect(network.retrieve(sam.id, 'sos')).resolves.toBeDefined();
  });

  it('stops for good: a late YES cannot undo a STOP', async () => {
    const { members, network } = setup();
    const sam = await members.addMember('me', input);
    await members.stopFinding('me', sam.id);
    members.simulateReply(sam.id, 'ACTIVE');

    expect(members.consentOf(sam.id)).toBe('REVOKED');
    await expect(network.retrieve(sam.id, 'manual')).rejects.toMatchObject({ failure: 'no-consent' });
  });

  it('records the guardian tick only for someone under 18', async () => {
    const { members } = setup();
    const child = await members.addMember('me', input);
    const adult = await members.addMember('me', { ...input, minor: false, guardianAttested: true });
    expect(child.guardianAttestedAt).toBeInstanceOf(Date);
    expect(adult.guardianAttestedAt).toBeNull();
  });

  it('resends only while waiting, once an hour, with the same refusals as the server', async () => {
    const { members } = setup();
    const sam = await members.addMember('me', input);
    expect(await members.resendRequest('me', sam.id)).toBe('sent');
    expect(await members.resendRequest('me', sam.id)).toBe('too-soon');

    members.simulateReply(sam.id, 'ACTIVE');
    expect(await members.resendRequest('me', sam.id)).toBe('not-pending');
  });
});
