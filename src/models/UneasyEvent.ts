import type { Coordinates } from './Journey';

/**
 * What the user reached for when they felt uneasy (Option 15 `AI5`).
 *
 * Logged for the route-safety work the spec anticipates: "log every uneasy
 * event, with time, location and what was chosen". Which action someone picks
 * says more than the fact they opened the screen — calling a guardian and
 * telling the whole circle are different situations.
 */
export type UneasyAction =
  | 'opened'
  | 'called-guardian'
  | 'fake-call'
  | 'told-circle'
  | 'dismissed';

export interface UneasyEvent {
  id: string;
  /** Null when the user was not on a journey — the screen is reachable regardless. */
  journeyId: string | null;
  action: UneasyAction;
  /** Where they were. Null when no fix was available; never fabricated. */
  location: Coordinates | null;
  at: Date;
}

/**
 * The copy shown after "Tell my circle".
 *
 * States exactly what was sent, because the entire value of a non-emergency
 * alert is that the user knows it was not an emergency one. Someone who thinks
 * they may have triggered an SOS will hesitate to use this again.
 */
export const TOLD_CIRCLE_CONFIRMATION =
  'Your circle knows you feel uneasy. Not an emergency — they can see your live location for the next 15 minutes.';
