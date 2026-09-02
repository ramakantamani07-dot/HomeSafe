import type { JourneyProvider, TerminalJourneyStatus } from '../../providers/JourneyProvider';
import { TERMINAL_JOURNEY_STATUSES } from '../../providers/JourneyProvider';
import type { Journey, StartJourneyInput } from '../../models/Journey';
import type { LocationUpdate } from '../../models/LocationUpdate';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export class MockJourneyProvider implements JourneyProvider {
  // userId → (journeyId → Journey)
  private readonly store = new Map<string, Map<string, Journey>>();

  private userStore(userId: string): Map<string, Journey> {
    if (!this.store.has(userId)) this.store.set(userId, new Map());
    return this.store.get(userId)!;
  }

  async createJourney(userId: string, input: StartJourneyInput): Promise<Journey> {
    await delay(300);
    const id = newId();
    const now = new Date();
    const nextCheckInAt = input.checkInIntervalMinutes
      ? new Date(now.getTime() + input.checkInIntervalMinutes * 60 * 1000)
      : null;

    const journey: Journey = {
      id,
      userId,
      destinationLabel: input.destinationLabel,
      startLocation: { ...input.startLocation },
      destinationCoordinates: input.destinationCoordinates
        ? { ...input.destinationCoordinates }
        : null,
      currentLocation: null,
      status: 'ACTIVE',
      startedAt: now,
      endedAt: null,
      createdAt: now,
      checkInIntervalMinutes: input.checkInIntervalMinutes,
      nextCheckInAt,
      routeDistanceMeters: null,
      routeDurationSeconds: null,
      initialEta: null,
    };
    this.userStore(userId).set(id, { ...journey });
    return { ...journey };
  }

  async getActiveJourney(userId: string): Promise<Journey | null> {
    await delay(300);
    for (const journey of this.userStore(userId).values()) {
      if (journey.status === 'ACTIVE') return { ...journey };
    }
    return null;
  }

  async updateJourneyStatus(
    userId: string,
    journeyId: string,
    status: TerminalJourneyStatus,
  ): Promise<Journey> {
    await delay(300);
    const store = this.userStore(userId);
    const existing = store.get(journeyId);
    if (!existing) throw new Error('Journey not found.');
    const updated: Journey = { ...existing, status, endedAt: new Date(), nextCheckInAt: null };
    store.set(journeyId, { ...updated });
    return { ...updated };
  }

  async saveLocationUpdate(
    userId: string,
    journeyId: string,
    update: LocationUpdate,
  ): Promise<void> {
    await delay(100);
    const store = this.userStore(userId);
    const existing = store.get(journeyId);
    if (!existing) return;
    store.set(journeyId, {
      ...existing,
      currentLocation: { latitude: update.latitude, longitude: update.longitude },
    });
  }

  async updateNextCheckInAt(
    userId: string,
    journeyId: string,
    nextCheckInAt: Date | null,
  ): Promise<void> {
    await delay(100);
    const store = this.userStore(userId);
    const existing = store.get(journeyId);
    if (!existing) return;
    store.set(journeyId, { ...existing, nextCheckInAt });
  }

  async setJourneySOSStatus(userId: string, journeyId: string): Promise<void> {
    await delay(100);
    const store = this.userStore(userId);
    const existing = store.get(journeyId);
    if (!existing) return;
    store.set(journeyId, { ...existing, status: 'SOS_TRIGGERED', nextCheckInAt: null });
  }

  async saveRouteData(
    userId: string,
    journeyId: string,
    distanceMeters: number,
    durationSeconds: number,
    initialEta: Date,
  ): Promise<void> {
    await delay(100);
    const store = this.userStore(userId);
    const existing = store.get(journeyId);
    if (!existing) return;
    store.set(journeyId, {
      ...existing,
      routeDistanceMeters: distanceMeters,
      routeDurationSeconds: durationSeconds,
      initialEta,
    });
  }

  async listJourneyHistory(userId: string): Promise<import('../../models/Journey').Journey[]> {
    await delay(200);
    return [...this.userStore(userId).values()]
      .filter((j) => (TERMINAL_JOURNEY_STATUSES as string[]).includes(j.status))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((j) => ({ ...j }));
  }

  async deleteJourneyLocationHistory(userId: string, journeyId: string): Promise<void> {
    await delay(200);
    const store = this.userStore(userId);
    const existing = store.get(journeyId);
    if (!existing) return;
    store.set(journeyId, { ...existing, currentLocation: null });
  }
}
