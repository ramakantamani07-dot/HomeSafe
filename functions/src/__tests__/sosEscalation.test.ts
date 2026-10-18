import { Timestamp } from 'firebase-admin/firestore';

import {
  ESCALATION_STEPS,
  acknowledgerName,
  dueStep,
  emergencyNumberForPhone,
  nextDueAt,
  samePhone,
} from '../sos/escalation';

const t0 = new Date('2026-10-18T21:00:00Z');
const at = (ms: number) => new Date(t0.getTime() + ms);
const sos = (extra: Record<string, unknown> = {}) => ({
  userId: 'u',
  journeyId: null,
  location: null,
  status: 'ACTIVE' as const,
  triggeredAt: Timestamp.fromDate(t0),
  ...extra,
});

describe('escalation steps', () => {
  it('only ever adds: a reminder at 2 minutes, then family at 5', () => {
    expect(ESCALATION_STEPS.map((s) => [s.afterMs / 60000, s.action])).toEqual([
      [2, 'remind-contacts'],
      [5, 'widen-to-family'],
    ]);
  });

  it('takes each step only when due, and in order', () => {
    expect(dueStep(sos(), at(119_000))).toBeNull();
    expect(dueStep(sos(), at(120_000))?.stage).toBe(1);
    expect(dueStep(sos({ escalationStage: 1 }), at(200_000))).toBeNull();
    expect(dueStep(sos({ escalationStage: 1 }), at(300_000))?.stage).toBe(2);
    expect(dueStep(sos({ escalationStage: 2 }), at(3_600_000))).toBeNull();
  });

  it('stops once anyone says "I\'m on it", or the SOS ends', () => {
    expect(dueStep(sos({ firstAckAt: Timestamp.fromDate(at(30_000)) }), at(600_000))).toBeNull();
    expect(dueStep(sos({ status: 'RESOLVED' }), at(600_000))).toBeNull();
  });

  it('carries on under duress, which leaves the SOS active on purpose', () => {
    expect(dueStep(sos({ duressTriggered: true }), at(120_000))?.stage).toBe(1);
  });

  it('knows when the next step is due', () => {
    expect(nextDueAt(t0, 0)).toEqual(at(120_000));
    expect(nextDueAt(t0, 1)).toEqual(at(300_000));
    expect(nextDueAt(t0, 2)).toBeNull();
  });
});

describe('who may say "I\'m on it"', () => {
  const contacts = [{ name: 'Mum', phone: '+447700900456' }];

  it('a trusted contact, named as the traveller knows them', () => {
    expect(acknowledgerName('07700 900456', 'Anita Sharma', contacts, false)).toBe('Mum');
  });

  it('someone in the family, by their own name', () => {
    expect(acknowledgerName('+447700900999', 'Dad', contacts, true)).toBe('Dad');
  });

  it('nobody else', () => {
    expect(acknowledgerName('+447700900999', 'Stranger', contacts, false)).toBeNull();
    expect(acknowledgerName(undefined, 'No phone', contacts, false)).toBeNull();
  });

  it('matches the same number written different ways, and never an empty one', () => {
    expect(samePhone('+44 7700 900456', '07700900456')).toBe(true);
    expect(samePhone('+919876543210', '9876543210')).toBe(true);
    expect(samePhone('+447700900456', '+447700900457')).toBe(false);
    expect(samePhone('', '07700900456')).toBe(false);
  });
});

describe('the number the traveller is told to call', () => {
  it("uses their market's number, else the GSM standard", () => {
    expect(emergencyNumberForPhone('+447700900123')).toBe('999');
    expect(emergencyNumberForPhone('+919876543210')).toBe('112');
    expect(emergencyNumberForPhone(undefined)).toBe('112');
  });
});
