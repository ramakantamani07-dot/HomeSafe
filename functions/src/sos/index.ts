import { HttpsError, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { appCallable } from '../shared/appCheck';
import { handleDeviceSos, parseDeviceSosBody, registerKey, revokeKeys, type KeyPlatform } from './handsFree';
import { acknowledge, runDueEscalations } from './escalation';

/**
 * Issues this phone an SOS key (see handsFree.ts). Called by the app when the
 * person turns on hands-free SOS. The key is returned once and never again.
 */
export const registerSosKey = appCallable('registerSosKey', async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const platform = (request.data as { platform?: unknown } | null)?.platform;
  if (platform !== 'ios' && platform !== 'android') {
    throw new HttpsError('invalid-argument', 'Unknown platform.');
  }
  return registerKey(uid, platform as KeyPlatform);
});

/** Revokes this phone's key (on sign-out or turning the feature off), or all of them. */
export const revokeSosKey = appCallable('revokeSosKey', async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const keyId = (request.data as { keyId?: unknown } | null)?.keyId;
  if (keyId !== undefined && typeof keyId !== 'string') {
    throw new HttpsError('invalid-argument', 'Unknown key.');
  }
  return { revoked: await revokeKeys(uid, keyId as string | undefined) };
});

/**
 * The hands-free SOS endpoint, called by the phone's App Intent (and later
 * Android's tile and voice listener) with its SOS key — not a login, which a
 * locked phone's extension does not have.
 *
 * Not behind App Check: an App Intents extension has no Firebase SDK to mint
 * a token. The key is the credential; it can only start an SOS for its owner,
 * is rate-limited, and is revoked on sign-out.
 */
export const deviceSos = onRequest({ cors: false }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ status: 'method-not-allowed' });
    return;
  }
  const parsed = parseDeviceSosBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ status: 'invalid-request' });
    return;
  }
  const outcome = await handleDeviceSos(parsed.value);
  const code =
    outcome.status === 'unauthorised' ? 401 :
    outcome.status === 'rate-limited' ? 429 :
    outcome.status === 'sent' ? 201 : 200;
  res.status(code).json(outcome);
});

/**
 * "I'm on it", from a trusted contact or family member, on an active SOS.
 * Only those people may; the first one stops escalation and the traveller is
 * told who (escalation.ts).
 */
export const acknowledgeSos = appCallable('acknowledgeSos', async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const { ownerId, sosId } = (request.data ?? {}) as { ownerId?: unknown; sosId?: unknown };
  const id = /^[A-Za-z0-9_-]{1,128}$/;
  if (typeof ownerId !== 'string' || !id.test(ownerId) || typeof sosId !== 'string' || !id.test(sosId)) {
    throw new HttpsError('invalid-argument', 'Unknown SOS.');
  }
  return acknowledge(uid, ownerId, sosId);
});

/** Every minute: the escalation steps that are due (escalation.ts). */
export const escalateSos = onSchedule('every 1 minutes', async () => {
  await runDueEscalations();
});
