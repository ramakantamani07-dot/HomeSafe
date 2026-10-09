/**
 * The Firestore half of network location, against the emulator: the
 * transactions, the audit writes and the retention clean-up that the pure
 * tests cannot reach.
 *
 * Skipped unless FIRESTORE_EMULATOR_HOST is set — run with
 * `npm run test:emulator` from functions/.
 */
import { Timestamp } from 'firebase-admin/firestore';

import { db } from '../shared/firebase';
import { setAdaptersForTesting } from '../networkLocation/adapters';
import { locate } from '../networkLocation/locate';
import { MockSmsProvider, createMockAdapters } from '../networkLocation/mockAdapters';
import { transitionConsent, consentRef } from '../networkLocation/store';
import { clearOldNetworkFixes } from '../retention';

const onEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const describeEmulator = onEmulator ? describe : describe.skip;

const OWNER = 'guardian-1';
const PHONE = '+447700900123';

async function seed(memberId: string, status: string, extra: Record<string, unknown> = {}) {
  const now = Timestamp.now();
  await db.doc(`users/${OWNER}`).set({ name: 'Priya' });
  await db.doc(`users/${OWNER}/basicPhoneMembers/${memberId}`).set({
    displayName: 'Nani',
    phoneNumber: PHONE,
    consentStatus: status,
  });
  await consentRef(OWNER, memberId).set({
    memberId,
    status,
    phoneNumber: PHONE,
    requestedAt: now,
    expiresAt: Timestamp.fromMillis(now.toMillis() + 86_400_000),
    activatedAt: null,
    updatedAt: now,
    requestSms: { status: 'sent', at: now },
    ...extra,
  });
}

async function audits(memberId: string) {
  const snap = await db.collection(`users/${OWNER}/locateAudits`).where('memberId', '==', memberId).get();
  return snap.docs.map((d) => d.data()).sort((a, b) => a.at.toMillis() - b.at.toMillis());
}

describeEmulator('network location on Firestore', () => {
  let sms: MockSmsProvider;

  beforeEach(() => {
    process.env.NETWORK_LOCATION_MARKETS = 'GB';
    const adapters = createMockAdapters('secret');
    sms = adapters.sms as MockSmsProvider;
    setAdaptersForTesting(adapters);
  });

  afterAll(() => setAdaptersForTesting(undefined));

  test('a permitted lookup is audited, reserves its rate-limit slot, and tells the member', async () => {
    await seed('m-ok', 'ACTIVE');

    const result = await locate(OWNER, 'm-ok', 'manual');
    expect(result.ok).toBe(true);

    const [audit] = await audits('m-ok');
    expect(audit).toMatchObject({ outcome: 'success', reason: 'manual', hasLocation: true });
    expect(audit.accuracyMeters).toBe(650);

    const consent = (await consentRef(OWNER, 'm-ok').get()).data()!;
    expect(consent.recentLookupsAt).toHaveLength(1);
    expect(consent.lastNoticeAt).toBeInstanceOf(Timestamp);
    expect(sms.outbox.map((m) => m.template)).toEqual(['transparency']);
  });

  test('a second Find within the minute is refused, audited, and sends no text', async () => {
    await seed('m-rate', 'ACTIVE');
    await locate(OWNER, 'm-rate', 'manual');
    const second = await locate(OWNER, 'm-rate', 'manual');

    expect(second).toEqual({ ok: false, failure: 'rate-limited' });
    expect((await audits('m-rate')).map((a) => a.outcome)).toEqual(['success', 'denied-rate-limited']);
    expect(sms.outbox).toHaveLength(1);
  });

  test('every status but ACTIVE is refused, and the refusal is audited', async () => {
    for (const status of ['PENDING_SMS', 'OPERATOR_PENDING', 'REVOKED']) {
      const id = `m-${status.toLowerCase()}`;
      await seed(id, status);
      expect(await locate(OWNER, id, 'manual')).toEqual({ ok: false, failure: 'no-consent' });
      expect((await audits(id)).map((a) => a.outcome)).toEqual(['denied-no-consent']);
    }
    expect(sms.outbox).toHaveLength(0);
  });

  test('someone who is not the guardian is refused as such', async () => {
    expect(await locate(OWNER, 'nobody', 'manual')).toEqual({ ok: false, failure: 'not-guardian' });
    expect((await audits('nobody')).map((a) => a.outcome)).toEqual(['denied-not-guardian']);
  });

  test('a market that is switched off locates no one', async () => {
    process.env.NETWORK_LOCATION_MARKETS = '';
    await seed('m-off', 'ACTIVE');
    expect(await locate(OWNER, 'm-off', 'manual')).toEqual({ ok: false, failure: 'operator-unavailable' });
  });

  test('a revocation records who did it, the event, and the mirror — and ends lookups', async () => {
    await seed('m-stop', 'ACTIVE');
    const t = await transitionConsent(consentRef(OWNER, 'm-stop'), 'revoke', 'STOP');
    expect(t).toMatchObject({ from: 'ACTIVE', to: 'REVOKED', trigger: 'member-revoked' });

    const consent = (await consentRef(OWNER, 'm-stop').get()).data()!;
    expect(consent).toMatchObject({ status: 'REVOKED', revokedBy: 'member-revoked' });
    const member = (await db.doc(`users/${OWNER}/basicPhoneMembers/m-stop`).get()).data()!;
    expect(member.consentStatus).toBe('REVOKED');
    const events = await db.collection(`users/${OWNER}/consentEvents`).where('memberId', '==', 'm-stop').get();
    expect(events.docs.map((d) => d.data().to)).toEqual(['REVOKED']);

    // Repeating it changes nothing: the state machine refuses REVOKED → REVOKED.
    expect(await transitionConsent(consentRef(OWNER, 'm-stop'), 'revoke', 'STOP')).toBeNull();
    expect(await locate(OWNER, 'm-stop', 'manual')).toEqual({ ok: false, failure: 'no-consent' });
  });

  test('retention clears old coordinates and keeps the audit', async () => {
    await seed('m-old', 'ACTIVE');
    await locate(OWNER, 'm-old', 'manual');

    expect(await clearOldNetworkFixes(Timestamp.fromMillis(Date.now() - 86_400_000))).toBe(0);
    expect(await clearOldNetworkFixes(Timestamp.fromMillis(Date.now() + 1_000))).toBeGreaterThanOrEqual(1);

    const [audit] = await audits('m-old');
    expect(audit).toMatchObject({ outcome: 'success', location: null, accuracyMeters: null, hasLocation: false });
  });
});

describeEmulator('safe zones on Firestore', () => {
  const { checkZone } = require('../networkLocation/safeZones');
  const { MockOperatorLocationProvider } = require('../networkLocation/mockAdapters');

  beforeEach(() => {
    process.env.NETWORK_LOCATION_MARKETS = 'GB';
    setAdaptersForTesting(createMockAdapters('secret'));
  });

  async function zoneAround(memberId: string, inside: boolean) {
    // The mock operator's position for PHONE, so the zone can be placed on or off it.
    const fix = await new MockOperatorLocationProvider().retrieve(PHONE, 0);
    const centre = inside ? { latitude: fix.latitude, longitude: fix.longitude } : { latitude: 0, longitude: 0 };
    const ref = db.collection(`users/${OWNER}/safeZones`).doc();
    await ref.set({ memberId, name: 'School', centre, radiusMeters: 800, createdAt: Timestamp.now() });
    return ref;
  }

  test('readings move the zone through hysteresis, audited, with one event', async () => {
    await seed('m-zone', 'ACTIVE');
    const ref = await zoneAround('m-zone', true);
    const check = async () => checkZone(require('../networkLocation/adapters').getAdapters(), await ref.get());

    await check();
    expect((await ref.get()).data()).toMatchObject({ state: 'inside', pendingCount: 0 });

    // Move the zone away: two readings outside before it flips.
    await ref.update({ centre: { latitude: 0, longitude: 0 } });
    await check();
    expect((await ref.get()).data()).toMatchObject({ state: 'inside', pendingState: 'outside', pendingCount: 1 });
    await check();
    expect((await ref.get()).data()).toMatchObject({ state: 'outside', pendingCount: 0 });

    const events = await db.collection(`users/${OWNER}/zoneEvents`).where('zoneId', '==', ref.id).get();
    expect(events.docs.map((d) => d.data().event)).toEqual(['left']);

    const audits = await db.collection(`users/${OWNER}/locateAudits`).where('memberId', '==', 'm-zone').get();
    expect(audits.docs.every((d) => d.data().reason === 'geofence' && d.data().location === null)).toBe(true);
    expect(audits.size).toBe(3);
  });

  test('a zone is not checked, or audited, without ACTIVE consent', async () => {
    await seed('m-zone-off', 'REVOKED');
    const ref = await zoneAround('m-zone-off', true);
    await checkZone(require('../networkLocation/adapters').getAdapters(), await ref.get());

    expect((await ref.get()).data()?.state).toBeUndefined();
    const audits = await db.collection(`users/${OWNER}/locateAudits`).where('memberId', '==', 'm-zone-off').get();
    expect(audits.size).toBe(0);
  });
});

describeEmulator('SOS and check-ins by text (6.6) on Firestore', () => {
  const { raiseMemberSos, recordMemberCheckIn } = require('../networkLocation/memberAlerts');
  let adapters: ReturnType<typeof createMockAdapters>;

  beforeEach(() => {
    process.env.NETWORK_LOCATION_MARKETS = 'GB';
    adapters = createMockAdapters('secret');
    setAdaptersForTesting(adapters);
  });

  const events = async (memberId: string) =>
    (await db.collection(`users/${OWNER}/memberEvents`).where('memberId', '==', memberId).get()).docs.map((d) => d.data());

  test('HELP locates even when Find is rate-limited, audits it, and records the event', async () => {
    await seed('m-sos', 'ACTIVE');
    await locate(OWNER, 'm-sos', 'manual'); // uses the minute's allowance
    expect(await locate(OWNER, 'm-sos', 'manual')).toEqual({ ok: false, failure: 'rate-limited' });

    await raiseMemberSos(adapters, [{ ownerId: OWNER, memberId: 'm-sos' }], 'sms', true);

    const [event] = await events('m-sos');
    expect(event).toMatchObject({ kind: 'sos', source: 'sms', failure: null });
    expect(event.location).not.toBeNull();
    expect((await audits('m-sos')).map((a) => [a.reason, a.outcome])).toContainEqual(['sos', 'success']);
  });

  test('a failed lookup still raises the alert, saying why there is no location', async () => {
    await seed('m-sos-off', 'ACTIVE');
    (adapters.operator as InstanceType<typeof import('../networkLocation/mockAdapters').MockOperatorLocationProvider>).failFor(
      PHONE,
      'device-unreachable',
    );
    await raiseMemberSos(adapters, [{ ownerId: OWNER, memberId: 'm-sos-off' }], 'call', true);
    expect((await events('m-sos-off'))[0]).toMatchObject({ kind: 'sos', source: 'call', location: null, failure: 'device-unreachable' });
  });

  test('HELP with STOP alerts without looking anyone up', async () => {
    await seed('m-sos-stop', 'ACTIVE');
    await raiseMemberSos(adapters, [{ ownerId: OWNER, memberId: 'm-sos-stop' }], 'sms', false);
    expect((await events('m-sos-stop'))[0]).toMatchObject({ location: null, failure: 'not-requested' });
    expect(await audits('m-sos-stop')).toHaveLength(0);
  });

  test('a check-in is recorded and never looks anyone up', async () => {
    await seed('m-home', 'ACTIVE');
    await recordMemberCheckIn([{ ownerId: OWNER, memberId: 'm-home' }], 'Home');
    expect((await events('m-home'))[0]).toMatchObject({ kind: 'checkin', label: 'Home', location: null });
    expect(await audits('m-home')).toHaveLength(0);
  });
});
