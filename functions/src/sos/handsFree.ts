import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';

import { db } from '../shared/firebase';
import { metric } from '../shared/metrics';
import type { StoredJourney, StoredSOS } from '../shared/types';

/**
 * Hands-free SOS: "Siri, WayLoc help me", the Action Button, Back Tap — and
 * later Android's tile and voice listener (docs/features/hands-free-sos.md).
 *
 * These run without the app: Siri runs WayLoc's App Intent in an extension,
 * on a locked phone, where neither the person's login nor the app's code is
 * available. So the phone holds an **SOS key** instead — a secret that can do
 * exactly one thing, start an SOS for its owner, and nothing else: it cannot
 * read a location, a contact or a journey.
 *
 * - The key is issued once (`registerKey`), shown to the phone once, and only
 *   its SHA-256 is stored. It is revoked on sign-out, and deleted with the
 *   account.
 * - `deviceSos` writes **the same SOS record the app writes**, so the existing
 *   `onSOSTriggered` sends every alert. There is no second emergency path.
 * - One trigger is one SOS: the phone sends a request id, which becomes the
 *   SOS id, so a retry never raises a second alarm.
 */

export const MAX_KEYS_PER_USER = 5;
/** Per key. Generous for a real emergency, useless for spamming someone's family. */
export const SOS_RATE_LIMIT = { max: 3, windowMs: 10 * 60 * 1000 };
/** A device fix older than this is not "where they are"; the journey's may be newer. */
export const DEVICE_FIX_MAX_AGE_MS = 30 * 60 * 1000;

export type KeyPlatform = 'ios' | 'android';

export interface StoredSosKey {
  userId: string;
  platform: KeyPlatform;
  hash: string;
  createdAt: Timestamp;
  revokedAt: Timestamp | null;
  /** Epoch ms of recent uses, for the rate limit. Trimmed to the window. */
  recent: number[];
  lastUsedAt: Timestamp | null;
}

export const sosKeys = () => db.collection('sosKeys');

// ── Pure helpers (tested without Firestore) ────────────────────────────────

export function hashKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

/** Constant-time, so a wrong key cannot be found a character at a time. */
export function keyMatches(storedHash: string, presented: string): boolean {
  const a = Buffer.from(storedHash, 'hex');
  const b = Buffer.from(hashKey(presented), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The uses still inside the window, and whether one more is allowed. */
export function rateCheck(
  recent: number[],
  now: number,
  limit = SOS_RATE_LIMIT,
): { allowed: boolean; kept: number[] } {
  const kept = recent.filter((t) => now - t < limit.windowMs);
  return { allowed: kept.length < limit.max, kept };
}

export interface DeviceSosRequest {
  keyId: string;
  key: string;
  requestId: string;
  test: boolean;
  location: { latitude: number; longitude: number; observedAt: Date } | null;
}

const ID = /^[A-Za-z0-9_-]{16,64}$/;
const KEY = /^[A-Za-z0-9_-]{40,64}$/;

/** Validates a request body. Anything unexpected is refused, not guessed at. */
export function parseDeviceSosBody(
  body: unknown,
): { ok: true; value: DeviceSosRequest } | { ok: false } {
  if (!body || typeof body !== 'object') return { ok: false };
  const b = body as Record<string, unknown>;
  if (typeof b.keyId !== 'string' || !ID.test(b.keyId)) return { ok: false };
  if (typeof b.key !== 'string' || !KEY.test(b.key)) return { ok: false };
  if (typeof b.requestId !== 'string' || !ID.test(b.requestId)) return { ok: false };
  if (b.test !== undefined && typeof b.test !== 'boolean') return { ok: false };

  let location: DeviceSosRequest['location'] = null;
  if (b.location !== undefined && b.location !== null) {
    const l = b.location as Record<string, unknown>;
    const lat = l.latitude;
    const lng = l.longitude;
    const at = typeof l.observedAt === 'string' ? new Date(l.observedAt) : null;
    const valid =
      typeof lat === 'number' && lat >= -90 && lat <= 90 &&
      typeof lng === 'number' && lng >= -180 && lng <= 180 &&
      at !== null && !Number.isNaN(at.getTime());
    if (!valid) return { ok: false };
    location = { latitude: lat as number, longitude: lng as number, observedAt: at as Date };
  }
  return {
    ok: true,
    value: { keyId: b.keyId, key: b.key, requestId: b.requestId, test: b.test === true, location },
  };
}

/**
 * Which position the alert carries: the phone's own fix when it is recent,
 * otherwise the active journey's last tracked one, otherwise none — and when
 * it was taken, so the alert can say "last known" honestly.
 */
export function chooseLocation(
  device: DeviceSosRequest['location'],
  journey: { location: { latitude: number; longitude: number } | null; at: Date | null } | null,
  now: Date,
): { location: { latitude: number; longitude: number } | null; observedAt: Date | null; source: 'device' | 'journey' | 'none' } {
  if (device && now.getTime() - device.observedAt.getTime() <= DEVICE_FIX_MAX_AGE_MS) {
    return { location: { latitude: device.latitude, longitude: device.longitude }, observedAt: device.observedAt, source: 'device' };
  }
  if (journey?.location) {
    return { location: journey.location, observedAt: journey.at, source: 'journey' };
  }
  if (device) {
    return { location: { latitude: device.latitude, longitude: device.longitude }, observedAt: device.observedAt, source: 'device' };
  }
  return { location: null, observedAt: null, source: 'none' };
}

// ── Keys ───────────────────────────────────────────────────────────────────

export async function registerKey(
  userId: string,
  platform: KeyPlatform,
  now = new Date(),
): Promise<{ keyId: string; key: string }> {
  const keyId = randomBytes(18).toString('base64url');
  const key = randomBytes(32).toString('base64url');

  const active = await sosKeys()
    .where('userId', '==', userId)
    .where('revokedAt', '==', null)
    .get();
  const batch = db.batch();
  // Keep at most MAX_KEYS_PER_USER live keys: the oldest give way.
  const oldestFirst = active.docs.sort(
    (a, b) => (a.get('createdAt') as Timestamp).toMillis() - (b.get('createdAt') as Timestamp).toMillis(),
  );
  const surplus = oldestFirst.length - (MAX_KEYS_PER_USER - 1);
  for (const doc of oldestFirst.slice(0, Math.max(0, surplus))) {
    batch.update(doc.ref, { revokedAt: Timestamp.fromDate(now) });
  }
  const stored: StoredSosKey = {
    userId,
    platform,
    hash: hashKey(key),
    createdAt: Timestamp.fromDate(now),
    revokedAt: null,
    recent: [],
    lastUsedAt: null,
  };
  batch.set(sosKeys().doc(keyId), stored);
  await batch.commit();
  return { keyId, key };
}

/** Revokes one key, or every key the person holds when `keyId` is omitted. */
export async function revokeKeys(userId: string, keyId?: string, now = new Date()): Promise<number> {
  const docs = keyId
    ? [await sosKeys().doc(keyId).get()].filter((d) => d.exists && d.get('userId') === userId)
    : (await sosKeys().where('userId', '==', userId).where('revokedAt', '==', null).get()).docs;
  if (docs.length === 0) return 0;
  const batch = db.batch();
  for (const d of docs) batch.update(d.ref, { revokedAt: Timestamp.fromDate(now) });
  await batch.commit();
  return docs.length;
}

// ── The SOS itself ─────────────────────────────────────────────────────────

export type DeviceSosOutcome =
  | { status: 'sent'; sosId: string }
  | { status: 'duplicate'; sosId: string }
  | { status: 'test-ok'; hasContacts: boolean }
  | { status: 'unauthorised' }
  | { status: 'rate-limited' };

export async function handleDeviceSos(req: DeviceSosRequest, now = new Date()): Promise<DeviceSosOutcome> {
  const keyRef = sosKeys().doc(req.keyId);
  const sosId = `hf-${req.requestId}`;

  const auth = await db.runTransaction(async (tx) => {
    const snap = await tx.get(keyRef);
    const stored = snap.data() as StoredSosKey | undefined;
    // One answer for unknown, wrong and revoked: nothing to learn by probing.
    if (!stored || stored.revokedAt || !keyMatches(stored.hash, req.key)) {
      return { ok: false as const, reason: 'unauthorised' as const };
    }
    // A retry of a trigger already sent is not a new use.
    const existing = await tx.get(db.doc(`users/${stored.userId}/sosEvents/${sosId}`));
    if (existing.exists) return { ok: true as const, userId: stored.userId, platform: stored.platform, duplicate: true };

    const { allowed, kept } = rateCheck(stored.recent ?? [], now.getTime());
    if (!allowed) return { ok: false as const, reason: 'rate-limited' as const };
    tx.update(keyRef, { recent: [...kept, now.getTime()], lastUsedAt: Timestamp.fromDate(now) });
    return { ok: true as const, userId: stored.userId, platform: stored.platform, duplicate: false };
  });

  if (!auth.ok) {
    metric('hands_free_sos', { outcome: auth.reason, platform: null, location: null });
    return { status: auth.reason };
  }
  if (auth.duplicate) {
    metric('hands_free_sos', { outcome: 'duplicate', platform: auth.platform, location: null });
    return { status: 'duplicate', sosId };
  }

  if (req.test) {
    const contact = await db.collection(`users/${auth.userId}/contacts`).limit(1).get();
    metric('hands_free_sos', { outcome: 'test', platform: auth.platform, location: null });
    return { status: 'test-ok', hasContacts: !contact.empty };
  }

  const journeys = await db
    .collection(`users/${auth.userId}/journeys`)
    .where('status', '==', 'ACTIVE')
    .limit(1)
    .get();
  const journeyDoc = journeys.docs[0];
  const journey = journeyDoc?.data() as (StoredJourney & { lastLocationAt?: Timestamp }) | undefined;
  const chosen = chooseLocation(
    req.location,
    journey
      ? { location: journey.currentLocation ?? null, at: journey.lastLocationAt?.toDate() ?? null }
      : null,
    now,
  );

  const ts = Timestamp.fromDate(now);
  // The record the app itself writes (FirebaseSOSProvider), so onSOSTriggered
  // treats it exactly the same — plus where it came from and how old the fix is.
  const sos: StoredSOS & Record<string, unknown> = {
    userId: auth.userId,
    journeyId: journeyDoc?.id ?? null,
    location: chosen.location,
    status: 'ACTIVE',
    triggeredAt: ts,
    resolvedAt: null,
    createdAt: ts,
    duressTriggered: false,
    source: 'hands-free',
    locationObservedAt: chosen.observedAt ? Timestamp.fromDate(chosen.observedAt) : null,
  };
  try {
    await db.doc(`users/${auth.userId}/sosEvents/${sosId}`).create(sos);
  } catch (err) {
    // Two deliveries of the same trigger racing: the first one won.
    if ((err as { code?: number }).code === 6) return { status: 'duplicate', sosId };
    throw err;
  }
  metric('hands_free_sos', { outcome: 'sent', platform: auth.platform, location: chosen.source });
  return { status: 'sent', sosId };
}

/** Removes a deleted account's keys (called from onUserAccountDeleted). */
export async function deleteKeysFor(userId: string): Promise<void> {
  const snap = await sosKeys().where('userId', '==', userId).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

