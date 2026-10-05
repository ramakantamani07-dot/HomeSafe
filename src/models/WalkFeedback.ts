/**
 * How a journey felt, asked once on arrival (Option 15 `AI6`).
 *
 * Three deliberate properties:
 *
 *  - **Private.** The spec is explicit: "Do not share it with guardians."
 *    Someone who felt unsafe on a route their parent chose has to be able to
 *    say so without that parent reading it, or the answers stop being honest
 *    and the data becomes worthless.
 *  - **Optional.** Arrival is a moment of relief, not a survey. Done works
 *    without answering.
 *  - **Not a safety signal.** It never raises an alert or changes a status —
 *    it is retrospective, and acting on it would be acting minutes too late.
 *    It exists to inform future route suggestions.
 */
export type WalkRating = 'fine' | 'uneasy' | 'unsafe';

export interface WalkFeedback {
  journeyId: string;
  rating: WalkRating;
  at: Date;
}

export const WALK_RATINGS: Array<{ rating: WalkRating; label: string }> = [
  { rating: 'fine', label: 'Fine' },
  { rating: 'uneasy', label: 'Uneasy' },
  { rating: 'unsafe', label: 'Unsafe' },
];

/**
 * Shown under the choices. Says both halves of the promise — that it is
 * private, and what it is for — because an unexplained question at the end of
 * a journey reads as surveillance.
 */
export const WALK_FEEDBACK_CAPTION =
  'Private. Helps wayLoc suggest better routes later.';
