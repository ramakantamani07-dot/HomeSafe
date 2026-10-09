import * as logger from 'firebase-functions/logger';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { db, messaging } from './firebase';
import type { AlertData, StoredContact, StoredUser } from './types';

/**
 * Guardian notification delivery: resolving who to notify, sending, and
 * pruning tokens that are permanently dead.
 *
 * Every alert path goes through `sendAlerts`, so token pruning and failure
 * logging happen in exactly one place.
 */

export interface ContactToken {
  userId: string;
  token: string;
}

/** What a trusted contact can be alerted about (their switches; SOS is always on). */
export type ContactAlertKind = 'sos' | 'missedCheckIn' | 'journeyStart';

/** Whether a contact wants this kind of alert. SOS cannot be switched off. */
export function wantsAlert(contact: StoredContact, kind: ContactAlertKind): boolean {
  if (kind === 'sos') return true;
  if (kind === 'missedCheckIn') return contact.alerts?.missedCheckIn ?? true;
  return contact.alerts?.journeyStart ?? false;
}

export interface AlertRecipients {
  /** Contacts with wayLoc and a registered device — told by push. */
  tokens: ContactToken[];
  /** Everyone else — told by SMS ("a text, even without the app"). */
  sms: string[];
}

/**
 * Who to alert, and how, for one kind of alert.
 *
 * Contacts are matched to wayLoc accounts by phone number. Those with a
 * device get a push; those without an account — or with one but no device
 * registered — get an SMS instead, so nobody who asked to be told is silently
 * skipped because they do not use the app. (Before Phase 5c they were.)
 */
export async function getAlertRecipients(userId: string, kind: ContactAlertKind): Promise<AlertRecipients> {
  const contactsSnap = await db.collection(`users/${userId}/contacts`).get();
  const phones = contactsSnap.docs
    .map((d: QueryDocumentSnapshot) => d.data() as StoredContact)
    .filter((c) => c.phone && wantsAlert(c, kind))
    .map((c) => c.phone);

  if (phones.length === 0) return { tokens: [], sms: [] };

  const tokens: ContactToken[] = [];
  const reachedByPush = new Set<string>();

  // Firestore 'in' supports up to 30 values per query.
  const BATCH = 30;
  for (let i = 0; i < phones.length; i += BATCH) {
    const batch = phones.slice(i, i + BATCH);
    const snap = await db.collection('users').where('phone', 'in', batch).get();
    snap.docs.forEach((d: QueryDocumentSnapshot) => {
      const user = d.data() as StoredUser;
      const token = user.fcmToken;
      if (token?.trim() && user.phone) {
        tokens.push({ userId: d.id, token });
        reachedByPush.add(user.phone);
      }
    });
  }

  return { tokens, sms: phones.filter((p) => !reachedByPush.has(p)) };
}

/** Push tokens only — kept for callers that do not text. */
export async function getContactFcmTokens(userId: string, kind: ContactAlertKind = 'sos'): Promise<ContactToken[]> {
  return (await getAlertRecipients(userId, kind)).tokens;
}

/**
 * Whether an FCM send failure means the token is permanently dead and should
 * be pruned, vs. a transient failure (network blip, quota) worth leaving
 * alone to retry next time. Exported as a pure function so this decision —
 * getting it wrong either over-prunes a working token or leaves dead ones
 * retried forever — is unit-testable without an Admin SDK connection.
 * See https://firebase.google.com/docs/reference/admin/error-handling#messaging.
 */
export function isDeadTokenError(errorCode: string | undefined): boolean {
  return (
    errorCode === 'messaging/registration-token-not-registered' ||
    errorCode === 'messaging/invalid-registration-token'
  );
}

/**
 * Sends an FCM message to each token in parallel. Per-token failures are
 * logged but do not abort the batch. When a token is permanently dead (app
 * uninstalled, token rotated without the app ever re-registering it), clears
 * it from the owning user's doc so future alerts stop retrying it forever.
 */
export async function sendAlerts(
  contactTokens: ContactToken[],
  title: string,
  body: string,
  data: AlertData,
): Promise<void> {
  if (contactTokens.length === 0) {
    logger.info('No FCM tokens found — no alerts sent', { alertType: data.type });
    return;
  }

  const results = await Promise.allSettled(
    contactTokens.map((ct) =>
      messaging.send({
        token: ct.token,
        notification: { title, body },
        data: data as unknown as Record<string, string>,
        android: { priority: 'high' },
        apns: {
          payload: {
            aps: { contentAvailable: true, sound: 'default' },
          },
        },
      }),
    ),
  );

  const deadTokenUserIds: string[] = [];
  results.forEach((r, i) => {
    if (r.status !== 'rejected') return;
    const code = (r.reason as { code?: string } | undefined)?.code;
    if (isDeadTokenError(code)) deadTokenUserIds.push(contactTokens[i].userId);
  });

  if (deadTokenUserIds.length > 0) {
    await Promise.allSettled(
      deadTokenUserIds.map((uid) =>
        db.doc(`users/${uid}`).update({ fcmToken: '' }),
      ),
    );
    logger.info(`Pruned ${deadTokenUserIds.length} dead FCM token(s)`, {
      alertType: data.type,
    });
  }

  const failed = results.filter((r) => r.status === 'rejected').length;
  logger.info(`Alerts sent: ${results.length - failed} ok, ${failed} failed`, {
    alertType: data.type,
  });
}
