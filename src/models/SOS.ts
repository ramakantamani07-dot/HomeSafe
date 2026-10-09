import type { Coordinates } from './Journey';

export type SOSStatus = 'ACTIVE' | 'RESOLVED';

export interface SOSEvent {
  id: string;
  userId: string;
  journeyId: string | null;
  /** Latest known location at the time SOS was triggered. */
  location: Coordinates | null;
  status: SOSStatus;
  triggeredAt: Date;
  resolvedAt: Date | null;
  createdAt: Date;
  /**
   * Set when the user "resolved" the alert with their duress code instead of
   * a real resolve. Status stays ACTIVE and tracking keeps running — this
   * flag exists only so the record itself shows what actually happened.
   */
  duressTriggered: boolean;
}

/**
 * How far the SOS press-and-hold got (Option 15 `AI8`).
 *
 *  0 — nothing sent. Released too early, which must stay a safe outcome: this
 *      control lives on the home screen, where a pocket press cannot be allowed
 *      to raise an alarm.
 *  1 — guardians alerted and live location shared.
 *  2 — the above, plus the emergency services call is offered.
 *
 * Two tiers on one gesture rather than two controls, because an emergency is
 * the worst moment to ask someone to choose between buttons.
 */
export type SOSTier = 0 | 1 | 2;

/** Guardians are alerted once the hold passes this, unless the user changed it. */
export const SOS_TIER_1_MS = 3_000;

/**
 * Hold durations offered in Settings (`AI11`, "SOS hold time").
 *
 * Deliberately a short bounded list rather than a free value. Both ends are
 * unsafe: too short and a pocket press raises an alarm, too long and someone
 * cannot trigger it while panicking. Three seconds stays the default because it
 * is long enough to be deliberate and short enough to complete under stress.
 */
export const SOS_HOLD_CHOICES_MS = [2_000, 3_000, 5_000] as const;

/**
 * Tier 2 is always double tier 1.
 *
 * Derived rather than separately configurable so the escalation keeps its shape
 * whatever the user picks: the second half of the hold always costs the same as
 * the first, so "hold on again as long as you just did" stays true.
 */
export function tier2For(tier1Ms: number): number {
  return tier1Ms * 2;
}

/** The default second threshold. */
export const SOS_TIER_2_MS = tier2For(SOS_TIER_1_MS);

/**
 * Seconds the user has to cancel after an alert is sent.
 *
 * Deliberately generous: the cost of a false alarm reaching guardians is
 * embarrassment, while the cost of a real one being cancellable for too short a
 * window is that a frightened person cannot undo a mistake.
 */
export const SOS_CANCEL_WINDOW_SECONDS = 10;

/**
 * The tier a hold of `heldMs` has reached.
 *
 * `tier1Ms` is a parameter rather than a module constant because Settings can
 * change it; callers pass the user's current preference.
 */
export function sosTierForHold(heldMs: number, tier1Ms: number = SOS_TIER_1_MS): SOSTier {
  if (heldMs >= tier2For(tier1Ms)) return 2;
  if (heldMs >= tier1Ms) return 1;
  return 0;
}

/**
 * 0–1 progress through the *current* tier, for the fill on the hold control.
 *
 * Resets at the tier boundary rather than running 0–1 across the whole six
 * seconds, so reaching tier 1 reads as an arrival rather than as the halfway
 * point of something still unfinished — the user has genuinely sent something
 * at that moment, and the control should say so.
 */
export function sosHoldProgress(heldMs: number, tier1Ms: number = SOS_TIER_1_MS): number {
  const tier2Ms = tier2For(tier1Ms);
  if (heldMs >= tier2Ms) return 1;
  if (heldMs >= tier1Ms) return (heldMs - tier1Ms) / (tier2Ms - tier1Ms);
  return heldMs / tier1Ms;
}

/**
 * The text a person can send their contacts themselves when the app has no
 * data connection (Phase 8: SMS fallback for SOS). SMS often still works
 * when data does not — weak signal, no data plan abroad — and is the one
 * channel the phone's own Messages app owns. A map link, never just
 * coordinates, because the person reading it may be stressed too.
 */
export function sosFallbackText(location: { latitude: number; longitude: number } | null): string {
  const where = location
    ? ` I'm near https://maps.google.com/?q=${location.latitude.toFixed(5)},${location.longitude.toFixed(5)}`
    : '';
  // Sign-off on its own line, so no punctuation touches the end of the link —
  // some phones would make it part of the URL.
  return `I need help.${where}\n(Sent from wayLoc — it couldn't reach the internet.)`;
}
