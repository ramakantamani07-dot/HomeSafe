import type { WalkFeedback, WalkRating } from '../../models/WalkFeedback';
import type { WalkFeedbackProvider } from '../../providers/WalkFeedbackProvider';

export class MockWalkFeedbackProvider implements WalkFeedbackProvider {
  private store = new Map<string, WalkFeedback[]>();

  async saveFeedback(userId: string, journeyId: string, rating: WalkRating): Promise<void> {
    const existing = this.store.get(userId) ?? [];
    // One answer per journey — re-answering replaces rather than appends.
    const without = existing.filter((f) => f.journeyId !== journeyId);
    this.store.set(userId, [...without, { journeyId, rating, at: new Date() }]);
  }

  async listFeedback(userId: string): Promise<WalkFeedback[]> {
    return [...(this.store.get(userId) ?? [])];
  }
}
