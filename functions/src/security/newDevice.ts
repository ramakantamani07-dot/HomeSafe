import * as logger from 'firebase-functions/logger';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';

import { db, messaging } from '../shared/firebase';
import { isDeadTokenError } from '../shared/messaging';
import { metric } from '../shared/metrics';
import type { StoredUser } from '../shared/types';
import { localTime, marketForNumber } from '../networkLocation/config';

/**
 * Sign-in on a phone this account has not been used on before
 * (docs/reference/ACCOUNT_PROTECTION.md).
 *
 * Phone-number sign-in means whoever holds the number can sign in, and a SIM
 * swap moves the number without touching the owner's phone. The owner's old
 * phone usually still has the app (and Wi-Fi), so it is told; so is everyone
 * in the family, who would otherwise keep sharing with whoever now holds the
 * account.
 *
 * Each installation registers itself once under `users/{uid}/devices/{id}`
 * (the id lives in the phone's secure storage). The first device on an account
 * is not news; any later one is. A reinstall on Android gets a new id, which
 * is why the copy says "a phone wayLoc hadn't seen before" rather than
 * claiming it is someone else's.
 */

/** Device record as the app writes it (src/implementations/devices). */
interface StoredDevice {
  platform?: string;
  pushToken?: string | null;
  alertedAt?: unknown;
}

interface StoredConnection {
  user1Id: string;
  user2Id: string;
  status: string;
}

export interface NewDeviceAlertPlan {
  /** Push tokens of the account's other phones. */
  ownTokens: string[];
  /** Family members to tell, by user id. */
  familyIds: string[];
}

/** Who hears about a new device. Pure, so the rule is tested without Firestore. */
export function planNewDeviceAlert(input: {
  userId: string;
  deviceId: string;
  devices: Array<{ id: string; pushToken?: string | null }>;
  connections: StoredConnection[];
}): NewDeviceAlertPlan | null {
  const others = input.devices.filter((d) => d.id !== input.deviceId);
  // The account's first phone: nothing to compare against, nothing to say.
  if (others.length === 0) return null;
  const ownTokens = [
    ...new Set(others.map((d) => d.pushToken?.trim()).filter((t): t is string => !!t)),
  ];
  const familyIds = [
    ...new Set(
      input.connections
        .filter((c) => c.status === 'ACTIVE')
        .map((c) => (c.user1Id === input.userId ? c.user2Id : c.user1Id))
        .filter((id) => id && id !== input.userId),
    ),
  ];
  return { ownTokens, familyIds };
}

export function platformName(platform: string | undefined): string {
  if (platform === 'ios') return 'an iPhone';
  if (platform === 'android') return 'an Android phone';
  return 'a device';
}

export const onDeviceRegistered = onDocumentCreated(
  'users/{userId}/devices/{deviceId}',
  async (event) => {
    const { userId, deviceId } = event.params;
    const ref = event.data?.ref;
    if (!ref) return;

    // Triggers are delivered at least once; a second delivery must not send
    // a second warning.
    const claimed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || (snap.data() as StoredDevice).alertedAt) return false;
      tx.update(ref, { alertedAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (!claimed) return;

    const [devicesSnap, asUser1, asUser2, ownerSnap] = await Promise.all([
      db.collection(`users/${userId}/devices`).get(),
      db.collection('familyConnections').where('user1Id', '==', userId).get(),
      db.collection('familyConnections').where('user2Id', '==', userId).get(),
      db.doc(`users/${userId}`).get(),
    ]);

    const plan = planNewDeviceAlert({
      userId,
      deviceId,
      devices: devicesSnap.docs.map((d) => ({ id: d.id, pushToken: (d.data() as StoredDevice).pushToken })),
      connections: [...asUser1.docs, ...asUser2.docs].map((d) => d.data() as StoredConnection),
    });
    if (!plan) return;

    const owner = ownerSnap.data() as StoredUser | undefined;
    const name = owner?.name?.trim() || 'Someone in your family';
    const time = localTime(new Date(), marketForNumber(owner?.phone ?? ''));
    const device = platformName((event.data?.data() as StoredDevice | undefined)?.platform);
    const data = { type: 'NEW_DEVICE_SIGN_IN', userId };

    const familyTokens = (
      await Promise.all(plan.familyIds.map((id) => db.doc(`users/${id}`).get()))
    )
      .map((s) => (s.data() as StoredUser | undefined)?.fcmToken?.trim())
      .filter((t): t is string => !!t);

    const send = (token: string, title: string, body: string) =>
      messaging.send({
        token,
        notification: { title, body },
        data,
        apns: { payload: { aps: { sound: 'default' } } },
      });

    const results = await Promise.allSettled([
      ...plan.ownTokens.map((t) =>
        send(
          t,
          'New sign-in to your wayLoc',
          `At ${time} on ${device} wayLoc hadn't seen before. If that wasn't you, ` +
            'call your mobile network now: someone may have moved your number to a new SIM.',
        ),
      ),
      ...familyTokens.map((t) =>
        send(
          t,
          `${name}'s wayLoc was signed in on a new phone`,
          `At ${time}. If ${name} hasn't changed phones, check with them another way before sharing more.`,
        ),
      ),
    ]);

    const reached = results.filter((r) => r.status === 'fulfilled').length;
    results.forEach((r) => {
      if (r.status === 'rejected') {
        const code = (r.reason as { code?: string } | undefined)?.code;
        if (!isDeadTokenError(code)) logger.warn('New-device push failed', { code });
      }
    });
    metric('new_device', {
      otherDevices: plan.ownTokens.length,
      family: plan.familyIds.length,
      reached,
      attempted: results.length,
    });
  },
);
