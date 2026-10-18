import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { db, messaging } from '../shared/firebase';
import { getAlertRecipients, sendAlerts } from '../shared/messaging';
import { metric } from '../shared/metrics';
import type { StoredContact, StoredSOS, StoredUser } from '../shared/types';
import { textContacts, mapLink } from '../alerts/contactSms';
import { EMERGENCY_NUMBER, marketForNumber } from '../networkLocation/config';

/**
 * SOS acknowledgements and escalation (docs/features/hands-free-sos.md §
 * "Acknowledgements and escalation").
 *
 * Escalation only ever **adds** people and urgency; it never holds anyone
 * back. Every trusted contact is alerted at once, as before. Then:
 *
 *   any time   a contact taps "I'm on it" → the traveller sees who, escalation stops
 *   +2 min     nobody has: a second, more urgent alert to every contact
 *   +5 min     still nobody: family members who are not contacts are alerted too,
 *              and the traveller's phone is told to call the emergency number
 *
 * "I'm on it" means seen and acting — never "safe". Only the traveller can end
 * an SOS (with Face ID). A duress "resolve" leaves the SOS ACTIVE, so
 * escalation carries on, as the duress code intends — but **nothing is sent to
 * the traveller's own phone** once duress is set: "Mum has seen your SOS" or
 * "nobody has responded" on a phone someone forced them to cancel on would
 * tell that person the SOS is still running.
 */

/** The iOS notification category whose action is "I'm on it" (app/_layout.tsx). */
export const SOS_ALERT_CATEGORY = 'wayloc.sos-alert';

/** The number the traveller is told to call: their market's, else the GSM standard. */
export function emergencyNumberForPhone(phone: string | undefined): string {
  const market = marketForNumber(phone ?? '');
  return market ? EMERGENCY_NUMBER[market] : '112';
}

export const ESCALATION_STEPS = [
  { stage: 1, afterMs: 2 * 60 * 1000, action: 'remind-contacts' },
  { stage: 2, afterMs: 5 * 60 * 1000, action: 'widen-to-family' },
] as const;

export type EscalationAction = (typeof ESCALATION_STEPS)[number]['action'];

export interface Ack {
  name: string;
  at: Timestamp;
}

/** What the SOS record carries for this (server-written; the rules lock it). */
export interface EscalationFields {
  acks?: Record<string, Ack>;
  firstAckAt?: Timestamp | null;
  escalationStage?: number;
  /** When the next step is due; absent once there is none. The timer's index. */
  escalationDueAt?: Timestamp;
}

type SosRecord = StoredSOS & EscalationFields;

// ── Pure rules ─────────────────────────────────────────────────────────────

/** When the first step is due, set as the alerts go out. */
export function firstDueAt(triggeredAt: Date): Date {
  return new Date(triggeredAt.getTime() + ESCALATION_STEPS[0].afterMs);
}

/**
 * The step to take now, or null. Nothing once someone has acknowledged, once
 * the SOS is no longer active, or once every step has run.
 */
export function dueStep(sos: SosRecord, now: Date): (typeof ESCALATION_STEPS)[number] | null {
  if (sos.status !== 'ACTIVE' || sos.firstAckAt) return null;
  const done = sos.escalationStage ?? 0;
  const next = ESCALATION_STEPS.find((s) => s.stage === done + 1);
  if (!next) return null;
  return now.getTime() - sos.triggeredAt.toDate().getTime() >= next.afterMs ? next : null;
}

/** When the step after `stage` is due, or null when `stage` was the last. */
export function nextDueAt(triggeredAt: Date, stage: number): Date | null {
  const next = ESCALATION_STEPS.find((s) => s.stage === stage + 1);
  return next ? new Date(triggeredAt.getTime() + next.afterMs) : null;
}

/** "+44 7700 900123" and "07700900123" are the same phone; compare digits from the end. */
export function samePhone(a: string, b: string): boolean {
  const da = a.replace(/\D/g, '');
  const db_ = b.replace(/\D/g, '');
  if (!da || !db_) return false;
  const n = Math.min(da.length, db_.length, 10);
  return da.slice(-n) === db_.slice(-n);
}

/**
 * Who may say "I'm on it": someone the traveller listed as a trusted contact,
 * or someone in their family. Returns the name the traveller knows them by.
 */
export function acknowledgerName(
  callerPhone: string | undefined,
  callerName: string | undefined,
  contacts: Array<Pick<StoredContact, 'name' | 'phone'>>,
  isFamily: boolean,
): string | null {
  const contact = callerPhone ? contacts.find((c) => c.phone && samePhone(c.phone, callerPhone)) : undefined;
  if (contact) return contact.name?.trim() || callerName?.trim() || 'A contact';
  if (isFamily) return callerName?.trim() || 'Someone in your family';
  return null;
}

// ── Firestore ──────────────────────────────────────────────────────────────

async function familyOf(userId: string): Promise<string[]> {
  const [a, b] = await Promise.all([
    db.collection('familyConnections').where('user1Id', '==', userId).where('status', '==', 'ACTIVE').get(),
    db.collection('familyConnections').where('user2Id', '==', userId).where('status', '==', 'ACTIVE').get(),
  ]);
  return [
    ...a.docs.map((d) => d.get('user2Id') as string),
    ...b.docs.map((d) => d.get('user1Id') as string),
  ];
}

async function pushTo(userId: string, title: string, body: string, data: Record<string, string>): Promise<boolean> {
  const token = ((await db.doc(`users/${userId}`).get()).data() as StoredUser | undefined)?.fcmToken?.trim();
  if (!token) return false;
  try {
    await messaging.send({
      token,
      notification: { title, body },
      data,
      apns: { payload: { aps: { sound: 'default', 'interruption-level': 'time-sensitive' } } },
    });
    return true;
  } catch {
    return false;
  }
}

export type AckOutcome = { status: 'acknowledged' | 'already' | 'not-active' | 'not-allowed' | 'not-found' };

/**
 * "I'm on it", from a contact or family member. Recorded once per person; the
 * first one stops escalation and the traveller's phone is told who.
 */
export async function acknowledge(
  callerId: string,
  ownerId: string,
  sosId: string,
  now = new Date(),
): Promise<AckOutcome> {
  if (callerId === ownerId) return { status: 'not-allowed' };
  const [caller, contactsSnap, family] = await Promise.all([
    db.doc(`users/${callerId}`).get(),
    db.collection(`users/${ownerId}/contacts`).get(),
    familyOf(ownerId),
  ]);
  const callerData = caller.data() as StoredUser | undefined;
  const name = acknowledgerName(
    callerData?.phone,
    callerData?.name,
    contactsSnap.docs.map((d) => d.data() as StoredContact),
    family.includes(callerId),
  );
  if (!name) return { status: 'not-allowed' };

  const ref = db.doc(`users/${ownerId}/sosEvents/${sosId}`);
  let underDuress = false;
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return 'not-found' as const;
    const sos = snap.data() as SosRecord;
    if (sos.status !== 'ACTIVE') return 'not-active' as const;
    underDuress = sos.duressTriggered === true;
    if (sos.acks?.[callerId]) return 'already' as const;
    const update: Record<string, unknown> = {
      [`acks.${callerId}`]: { name, at: Timestamp.fromDate(now) },
    };
    if (!sos.firstAckAt) {
      update.firstAckAt = Timestamp.fromDate(now);
      update.escalationDueAt = FieldValue.delete();
    }
    tx.update(ref, update);
    return 'acknowledged' as const;
  });

  if (result === 'acknowledged' && !underDuress) {
    await pushTo(ownerId, `${name} has seen your SOS`, `${name} is responding. Your SOS stays on until you end it.`, {
      type: 'SOS_ACKNOWLEDGED',
      sosId,
    });
  }
  metric('sos_ack', { outcome: result });
  return { status: result };
}

/** Runs every due escalation step. Each step is claimed first, so overlapping runs never repeat one. */
export async function runDueEscalations(now = new Date()): Promise<number> {
  const due = await db
    .collectionGroup('sosEvents')
    .where('status', '==', 'ACTIVE')
    .where('escalationDueAt', '<=', Timestamp.fromDate(now))
    .limit(50)
    .get();

  let ran = 0;
  for (const doc of due.docs) {
    const step = await db.runTransaction(async (tx) => {
      const snap = await tx.get(doc.ref);
      const sos = snap.data() as SosRecord | undefined;
      if (!sos) return null;
      const s = dueStep(sos, now);
      if (!s) {
        // Acknowledged or ended since the query: nothing more is due.
        tx.update(doc.ref, { escalationDueAt: FieldValue.delete() });
        return null;
      }
      const next = nextDueAt(sos.triggeredAt.toDate(), s.stage);
      tx.update(doc.ref, {
        escalationStage: s.stage,
        escalationDueAt: next ? Timestamp.fromDate(next) : FieldValue.delete(),
      });
      return { step: s, sos };
    });
    if (!step) continue;
    const ownerId = doc.ref.parent.parent!.id;
    await perform(step.step.action, ownerId, doc.id, step.sos);
    ran += 1;
  }
  return ran;
}

async function perform(action: EscalationAction, ownerId: string, sosId: string, sos: SosRecord): Promise<void> {
  const owner = (await db.doc(`users/${ownerId}`).get()).data() as StoredUser | undefined;
  const name = owner?.name?.trim() || 'A contact';
  const minutes = action === 'remind-contacts' ? 2 : 5;
  const data = {
    type: 'SOS_TRIGGERED' as const,
    userId: ownerId,
    userName: name,
    journeyId: sos.journeyId ?? '',
    timestamp: sos.triggeredAt.toDate().toISOString(),
    location: sos.location ? `${sos.location.latitude.toFixed(5)},${sos.location.longitude.toFixed(5)}` : '',
    sosId,
  };

  if (action === 'remind-contacts') {
    const { tokens, sms } = await getAlertRecipients(ownerId, 'sos');
    const link = mapLink(sos.location);
    await textContacts(
      sms,
      'contact-sos-reminder',
      `wayLoc SOS: ${name}'s SOS is still active and nobody has responded yet.${link ? ` Last location: ${link}` : ''} Call them now — if you can't reach them, call the emergency services.`,
    );
    await sendAlerts(
      tokens,
      '🚨 SOS still active',
      `${name}'s SOS is still active and nobody has responded for ${minutes} minutes. Tap "I'm on it" if you're helping.`,
      data,
      { category: SOS_ALERT_CATEGORY },
    );
    metric('sos_escalation', { stage: 1, pushed: tokens.length, texted: sms.length });
    return;
  }

  // widen-to-family: family who are not already contacts, and the traveller.
  const { tokens } = await getAlertRecipients(ownerId, 'sos');
  const alreadyTold = new Set(tokens.map((t) => t.userId));
  const family = (await familyOf(ownerId)).filter((id) => !alreadyTold.has(id));
  let reached = 0;
  for (const id of family) {
    if (await pushTo(id, `🚨 ${name} needs help`, `${name}'s SOS has been active for ${minutes} minutes and nobody has responded. Tap to see where they are.`, data)) {
      reached += 1;
    }
  }
  const emergency = emergencyNumberForPhone(owner?.phone);
  // Never under duress: see the note at the top of this file.
  if (sos.duressTriggered !== true) await pushTo(
    ownerId,
    'Nobody has responded yet',
    `Your SOS is still active. If you can, call ${emergency} now.`,
    { type: 'SOS_NO_RESPONSE', sosId },
  );
  metric('sos_escalation', { stage: 2, pushed: reached, texted: 0 });
}

