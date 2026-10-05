import type { WalkFeedback, WalkRating } from '../models/WalkFeedback';

/**
 * Persistence for how a journey felt.
 *
 * A separate port from JourneyProvider on purpose: this data has a different
 * audience (nobody but the owner) and a different lifetime from the journey
 * record, and keeping it behind its own interface makes "guardians can never
 * read this" a property of the storage boundary rather than of a query.
 */
export interface WalkFeedbackProvider {
  saveFeedback(userId: string, journeyId: string, rating: WalkRating): Promise<void>;
  /** The owner's own history, for the future route-safety work. */
  listFeedback(userId: string): Promise<WalkFeedback[]>;
}
