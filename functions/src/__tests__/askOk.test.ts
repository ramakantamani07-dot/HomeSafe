/** Who may be asked "OK?", and how often (Option 15 S2c). */
import { ASK_OK_MIN_INTERVAL_MS, gateAskOk } from '../family/askOk';

describe('gateAskOk', () => {
  const now = new Date('2026-10-08T21:00:00Z');
  const connection = { user1Id: 'mum', user2Id: 'emma', status: 'ACTIVE' as const };
  const base = { connection, askerId: 'mum', memberStatus: 'TRAVELLING', lastAskedAt: null, now };

  it('asks a member who is travelling', () => {
    expect(gateAskOk(base)).toBeNull();
  });

  it('refuses outsiders and inactive connections first', () => {
    expect(gateAskOk({ ...base, askerId: 'stranger' })).toBe('not-member');
    expect(gateAskOk({ ...base, connection: { ...connection, status: 'CANCELLED' } })).toBe('not-member');
    expect(gateAskOk({ ...base, connection: undefined })).toBe('not-member');
  });

  it('only asks someone on a journey, as shared with the asker', () => {
    expect(gateAskOk({ ...base, memberStatus: 'IDLE' })).toBe('not-travelling');
    expect(gateAskOk({ ...base, memberStatus: null })).toBe('not-travelling');
  });

  it('waits five minutes between asks', () => {
    const recently = new Date(now.getTime() - ASK_OK_MIN_INTERVAL_MS + 1_000);
    expect(gateAskOk({ ...base, lastAskedAt: recently })).toBe('too-soon');
    expect(gateAskOk({ ...base, lastAskedAt: new Date(now.getTime() - ASK_OK_MIN_INTERVAL_MS) })).toBeNull();
  });
});
