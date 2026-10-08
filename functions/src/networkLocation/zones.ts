/**
 * Safe zones (Phase 6.5): the rules, pure. Mirrored in `src/models/SafeZone.ts`
 * and held equal by the parity test.
 */

/**
 * The smallest zone worth having. Network location is accurate to hundreds of
 * metres, so a 100 m "home" would flicker in and out on noise alone and every
 * alert would be a guess.
 */
export const ZONE_MIN_RADIUS_M = 500;
export const ZONE_MAX_RADIUS_M = 5_000;

/** Zones per member. Each is a verification every interval, which is a billed call. */
export const ZONES_PER_MEMBER = 5;

/**
 * Readings in a row that must agree before a zone flips. One reading is noise
 * at a zone edge; two, fifteen minutes apart, is someone who has gone.
 */
export const ZONE_CONFIRMATIONS = 2;

export type ZoneState = 'inside' | 'outside' | 'unknown';

export interface ZoneTracking {
  state: ZoneState;
  /** The state readings are currently pointing at, if different from `state`. */
  pendingState: Exclude<ZoneState, 'unknown'> | null;
  pendingCount: number;
}

export type ZoneEvent = 'arrived' | 'left';

/**
 * One verification result applied to a zone.
 *
 * - **The first reading only sets the state.** From `unknown` there is no
 *   event: someone found inside on the first check did not "arrive" — they
 *   may have been there all day — and saying so would be invented.
 * - **A flip needs `ZONE_CONFIRMATIONS` agreeing readings** (hysteresis), and
 *   a reading that agrees with the current state clears any pending flip, so
 *   an edge that wobbles in/out/in produces nothing.
 * - **Events are only flips**, so a repeated reading can never re-alert
 *   (de-duplication by construction).
 */
export function applyZoneReading(
  tracking: ZoneTracking,
  inside: boolean,
): ZoneTracking & { event: ZoneEvent | null } {
  const reading = inside ? 'inside' : 'outside';

  if (tracking.state === 'unknown') {
    return { state: reading, pendingState: null, pendingCount: 0, event: null };
  }
  if (reading === tracking.state) {
    return { state: tracking.state, pendingState: null, pendingCount: 0, event: null };
  }

  const count = tracking.pendingState === reading ? tracking.pendingCount + 1 : 1;
  if (count < ZONE_CONFIRMATIONS) {
    return { state: tracking.state, pendingState: reading, pendingCount: count, event: null };
  }
  return {
    state: reading,
    pendingState: null,
    pendingCount: 0,
    event: reading === 'inside' ? 'arrived' : 'left',
  };
}
