import { Timestamp } from 'firebase-admin/firestore';

import { db, messaging } from '../shared/firebase';
import { acknowledge, firstDueAt, runDueEscalations } from '../sos/escalation';

const onEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const describeEmulator = onEmulator ? describe : describe.skip;

const OWNER = 'esc-owner';
const MUM = 'esc-mum';
const STRANGER = 'esc-stranger';
const t0 = new Date('2026-10-18T21:00:00Z');
const at = (ms: number) => new Date(t0.getTime() + ms);

type Sent = { token: string; title?: string };
let sent: Sent[] = [];

async function wipe() {
  for (const path of [`users/${OWNER}/sosEvents`, `users/${OWNER}/contacts`]) {
    const snap = await db.collection(path).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
}

async function seedSos(id: string, extra: Record<string, unknown> = {}) {
  await db.doc(`users/${OWNER}/sosEvents/${id}`).set({
    userId: OWNER,
    journeyId: null,
    location: { latitude: 51.47, longitude: -0.07 },
    status: 'ACTIVE',
    triggeredAt: Timestamp.fromDate(t0),
    duressTriggered: false,
    escalationStage: 0,
    escalationDueAt: Timestamp.fromDate(firstDueAt(t0)),
    ...extra,
  });
}

describeEmulator('SOS acknowledgements and escalation (emulator)', () => {
  beforeAll(async () => {
    await db.doc(`users/${OWNER}`).set({ name: 'Priya', phone: '+447700900123', fcmToken: 'tok-owner' });
    await db.doc(`users/${MUM}`).set({ name: 'Anita', phone: '+447700900456', fcmToken: 'tok-mum' });
    await db.doc(`users/${STRANGER}`).set({ name: 'Stranger', phone: '+447700900999', fcmToken: 'tok-x' });
  });

  beforeEach(async () => {
    await wipe();
    await db.collection(`users/${OWNER}/contacts`).add({ name: 'Mum', phone: '+447700900456' });
    sent = [];
    jest.spyOn(messaging, 'send').mockImplementation(async (m: unknown) => {
      const msg = m as { token: string; notification?: { title?: string } };
      sent.push({ token: msg.token, title: msg.notification?.title });
      return 'ok';
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('a trusted contact can say "I\'m on it"; the traveller is told who, and escalation stops', async () => {
    await seedSos('s1');
    expect(await acknowledge(MUM, OWNER, 's1', at(30_000))).toEqual({ status: 'acknowledged' });
    const doc = (await db.doc(`users/${OWNER}/sosEvents/s1`).get()).data()!;
    expect(doc.acks[MUM].name).toBe('Mum');
    expect(doc.firstAckAt).toBeTruthy();
    expect(doc.escalationDueAt).toBeUndefined();
    expect(sent).toEqual([{ token: 'tok-owner', title: 'Mum has seen your SOS' }]);
    expect(await runDueEscalations(at(600_000))).toBe(0);
  });

  it('nobody else can, nor the traveller, and a second tap changes nothing', async () => {
    await seedSos('s2');
    expect(await acknowledge(STRANGER, OWNER, 's2')).toEqual({ status: 'not-allowed' });
    expect(await acknowledge(OWNER, OWNER, 's2')).toEqual({ status: 'not-allowed' });
    await acknowledge(MUM, OWNER, 's2');
    expect(await acknowledge(MUM, OWNER, 's2')).toEqual({ status: 'already' });
  });

  it('escalates at 2 and 5 minutes, once each, and not before', async () => {
    await seedSos('s3');
    expect(await runDueEscalations(at(60_000))).toBe(0);

    expect(await runDueEscalations(at(120_000))).toBe(1);
    expect(sent.map((s) => s.title)).toContain('🚨 SOS still active');
    // A second run in the same minute repeats nothing.
    expect(await runDueEscalations(at(130_000))).toBe(0);

    sent = [];
    expect(await runDueEscalations(at(300_000))).toBe(1);
    expect(sent).toContainEqual({ token: 'tok-owner', title: 'Nobody has responded yet' });
    expect(await runDueEscalations(at(3_600_000))).toBe(0);
    expect((await db.doc(`users/${OWNER}/sosEvents/s3`).get()).get('escalationStage')).toBe(2);
  });

  it("under duress, escalation goes on but the traveller's phone is never messaged", async () => {
    await seedSos('s4', { duressTriggered: true });
    await runDueEscalations(at(120_000));
    await runDueEscalations(at(300_000));
    await acknowledge(MUM, OWNER, 's4');
    expect(sent.some((s) => s.title === '🚨 SOS still active')).toBe(true);
    expect(sent.filter((s) => s.token === 'tok-owner')).toEqual([]);
  });

  it('an ended SOS is not escalated or acknowledged', async () => {
    await seedSos('s5', { status: 'RESOLVED' });
    expect(await runDueEscalations(at(600_000))).toBe(0);
    expect(await acknowledge(MUM, OWNER, 's5')).toEqual({ status: 'not-active' });
  });
});
