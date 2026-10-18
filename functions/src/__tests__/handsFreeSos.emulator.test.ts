import { db } from '../shared/firebase';
import { handleDeviceSos, registerKey, revokeKeys, sosKeys, SOS_RATE_LIMIT, type DeviceSosRequest } from '../sos/handsFree';

const onEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const describeEmulator = onEmulator ? describe : describe.skip;

const USER = 'hf-user-1';
let seq = 0;
const requestId = () => `req-${Date.now()}-${++seq}-abcdefgh`;

async function clear() {
  const keys = await sosKeys().where('userId', '==', USER).get();
  const sos = await db.collection(`users/${USER}/sosEvents`).get();
  const journeys = await db.collection(`users/${USER}/journeys`).get();
  const contacts = await db.collection(`users/${USER}/contacts`).get();
  await Promise.all([...keys.docs, ...sos.docs, ...journeys.docs, ...contacts.docs].map((d) => d.ref.delete()));
}

describeEmulator('hands-free SOS (emulator)', () => {
  beforeEach(clear);

  const req = (key: { keyId: string; key: string }, extra: Partial<DeviceSosRequest> = {}): DeviceSosRequest => ({
    keyId: key.keyId,
    key: key.key,
    requestId: requestId(),
    test: false,
    location: null,
    ...extra,
  });

  it('writes the same SOS record the app writes, so the usual alerts fire', async () => {
    const key = await registerKey(USER, 'ios');
    const out = await handleDeviceSos(req(key, { location: { latitude: 51.47, longitude: -0.07, observedAt: new Date() } }));
    expect(out.status).toBe('sent');
    const sos = (await db.doc(`users/${USER}/sosEvents/${(out as { sosId: string }).sosId}`).get()).data();
    expect(sos).toMatchObject({
      userId: USER,
      status: 'ACTIVE',
      location: { latitude: 51.47, longitude: -0.07 },
      duressTriggered: false,
      source: 'hands-free',
    });
  });

  it('raises one SOS per trigger, however often the phone retries', async () => {
    const key = await registerKey(USER, 'ios');
    const r = req(key);
    const first = await handleDeviceSos(r);
    const again = await handleDeviceSos(r);
    expect(first.status).toBe('sent');
    expect(again).toEqual({ status: 'duplicate', sosId: (first as { sosId: string }).sosId });
    expect((await db.collection(`users/${USER}/sosEvents`).get()).size).toBe(1);
  });

  it('refuses a wrong, unknown or revoked key with one answer', async () => {
    const key = await registerKey(USER, 'ios');
    expect(await handleDeviceSos(req({ ...key, key: 'x'.repeat(43) }))).toEqual({ status: 'unauthorised' });
    expect(await handleDeviceSos(req({ keyId: 'no-such-key-0000000', key: key.key }))).toEqual({ status: 'unauthorised' });
    await revokeKeys(USER, key.keyId);
    expect(await handleDeviceSos(req(key))).toEqual({ status: 'unauthorised' });
    expect((await db.collection(`users/${USER}/sosEvents`).get()).size).toBe(0);
  });

  it('stores only a hash of the key', async () => {
    const key = await registerKey(USER, 'android');
    const stored = (await sosKeys().doc(key.keyId).get()).data();
    expect(JSON.stringify(stored)).not.toContain(key.key);
  });

  it(`rate-limits a key after ${SOS_RATE_LIMIT.max} SOS`, async () => {
    const key = await registerKey(USER, 'ios');
    for (let i = 0; i < SOS_RATE_LIMIT.max; i++) {
      expect((await handleDeviceSos(req(key))).status).toBe('sent');
    }
    expect(await handleDeviceSos(req(key))).toEqual({ status: 'rate-limited' });
  });

  it('a test run checks everything and alerts nobody', async () => {
    const key = await registerKey(USER, 'ios');
    expect(await handleDeviceSos(req(key, { test: true }))).toEqual({ status: 'test-ok', hasContacts: false });
    await db.collection(`users/${USER}/contacts`).add({ name: 'Mum', phone: '+447700900456' });
    expect(await handleDeviceSos(req(key, { test: true }))).toEqual({ status: 'test-ok', hasContacts: true });
    expect((await db.collection(`users/${USER}/sosEvents`).get()).size).toBe(0);
  });

  it("uses the active journey's last position when the phone has no fix, and links the journey", async () => {
    const key = await registerKey(USER, 'ios');
    const journey = await db.collection(`users/${USER}/journeys`).add({
      status: 'ACTIVE',
      currentLocation: { latitude: 51.5, longitude: -0.1 },
    });
    const out = await handleDeviceSos(req(key));
    const sos = (await db.doc(`users/${USER}/sosEvents/${(out as { sosId: string }).sosId}`).get()).data();
    expect(sos).toMatchObject({ journeyId: journey.id, location: { latitude: 51.5, longitude: -0.1 } });
  });

  it('keeps at most five live keys per person', async () => {
    for (let i = 0; i < 6; i++) await registerKey(USER, 'ios');
    const live = await sosKeys().where('userId', '==', USER).where('revokedAt', '==', null).get();
    expect(live.size).toBe(5);
  });
});
