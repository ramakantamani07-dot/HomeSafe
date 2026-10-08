import type { Coordinates } from './Journey';

/**
 * A safe zone for a basic-phone member (Phase 6.5, spec §6).
 *
 * Limits and states mirror `functions/src/networkLocation/zones.ts`; the
 * parity test holds them equal. The server checks zones and writes their
 * state; the app only draws the circle and reads what came back.
 */
export const ZONE_MIN_RADIUS_M = 500;
export const ZONE_MAX_RADIUS_M = 5_000;
export const ZONES_PER_MEMBER = 5;

/** Radii offered when adding a zone — all within the limits above. */
export const ZONE_RADIUS_CHOICES = [500, 1_000, 2_000] as const;

export type ZoneState = 'inside' | 'outside' | 'unknown';

export interface SafeZone {
  id: string;
  memberId: string;
  name: string;
  centre: Coordinates;
  radiusMeters: number;
  /** As of the last check. `unknown` until one has run. */
  state: ZoneState;
  lastCheckedAt: Date | null;
  /** When they last arrived or left — only set by a confirmed change. */
  lastEventAt: Date | null;
  createdAt: Date;
}

export interface NewSafeZone {
  memberId: string;
  name: string;
  centre: Coordinates;
  radiusMeters: number;
}

/** Whether another zone may be added for a member who has `existing`. */
export function canAddZone(existing: number): boolean {
  return existing < ZONES_PER_MEMBER;
}

/**
 * How a zone reads in the list. Says what the network last answered and when,
 * never more: "inside" is "inside the circle at 08:42", not "safe at school".
 */
export function describeZone(zone: SafeZone, now: Date): string {
  if (zone.state === 'unknown' || !zone.lastCheckedAt) return 'Waiting for the first check';
  const minutes = Math.max(0, Math.round((now.getTime() - zone.lastCheckedAt.getTime()) / 60_000));
  const when = minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} h ago`;
  return `${zone.state === 'inside' ? 'Inside' : 'Not inside'} · checked ${when}`;
}
