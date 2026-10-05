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

/**
 * Looks up FCM tokens for all of a user's trusted contacts who have the app.
 *
 * Flow:
 *   1. Read contact phone numbers from users/{userId}/contacts.
 *   2. Query the top-level users collection by phone number in batches.
 *   3. Return any non-empty fcmToken values found, paired with the owning
 *      user's uid so a later delivery failure can be pruned from the right doc.
 *
 * Contacts without the app simply won't have a matching user document and are
 * silently skipped. SMS alerts for non-app contacts are out of scope here.
 */
export async function getContactFcmTokens(userId: string): Promise<ContactToken[]> {
  const contactsSnap = await db
    .collection(`users/${userId}/contacts`)
    .get();

  const phones = contactsSnap.docs
    .map((d: QueryDocumentSnapshot) => (d.data() as StoredContact).phone)
    .filter(Boolean);

  if (phones.length === 0) return [];

  const contactTokens: ContactToken[] = [];

  // Firestore 'in' supports up to 30 values per query.
  const BATCH = 30;
  for (let i = 0; i < phones.length; i += BATCH) {
    const batch = phones.slice(i, i + BATCH);
    const snap = await db
      .collection('users')
      .where('phone', 'in', batch)
      .get();

    snap.docs.forEach((d: QueryDocumentSnapshot) => {
      const token = (d.data() as StoredUser).fcmToken;
      if (token?.trim()) contactTokens.push({ userId: d.id, token });
    });
  }

  return contactTokens;
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
