import type { Coordinates } from '../../models/Journey';
import type { UneasyAction, UneasyEvent } from '../../models/UneasyEvent';
import type { UneasyEventProvider } from '../../providers/UneasyEventProvider';

export class MockUneasyEventProvider implements UneasyEventProvider {
  private store = new Map<string, UneasyEvent[]>();
  private nextId = 1;

  async logEvent(
    userId: string,
    action: UneasyAction,
    journeyId: string | null,
    location: Coordinates | null,
  ): Promise<void> {
    const existing = this.store.get(userId) ?? [];
    // Appended, never replaced: two uneasy moments on one journey are two
    // events, and collapsing them would erase exactly the pattern this log
    // exists to reveal.
    this.store.set(userId, [
      ...existing,
      { id: `uneasy-${this.nextId++}`, journeyId, action, location, at: new Date() },
    ]);
  }

  async listEvents(userId: string): Promise<UneasyEvent[]> {
    return [...(this.store.get(userId) ?? [])];
  }
}
