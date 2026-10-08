import type { Coordinates } from '../models/Journey';
import type { UneasyAction, UneasyEvent } from '../models/UneasyEvent';

/**
 * Persistence for "Feeling uneasy?" events.
 *
 * Its own port rather than a field on the journey: these events happen whether
 * or not a journey is running, outlive the journey that prompted them, and are
 * read by nobody but the owner and the future route-safety work. Giving them
 * their own boundary keeps that true in storage rather than by convention.
 *
 * **Logging must never block the action.** Someone who taps "Call Mum" gets the
 * call whether or not the write succeeds, so implementations should fail quietly
 * and callers should not await them on the critical path.
 */
export interface UneasyEventProvider {
  logEvent(
    userId: string,
    action: UneasyAction,
    journeyId: string | null,
    location: Coordinates | null,
  ): Promise<void>;

  /** The owner's own history. */
  listEvents(userId: string): Promise<UneasyEvent[]>;
}
