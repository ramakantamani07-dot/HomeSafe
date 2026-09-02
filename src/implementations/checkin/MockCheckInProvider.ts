import type { CheckInProvider, CheckInUpdates } from '../../providers/CheckInProvider';
import type { CheckIn } from '../../models/CheckIn';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export class MockCheckInProvider implements CheckInProvider {
  // userId → journeyId → checkInId → CheckIn
  private readonly store = new Map<string, Map<string, Map<string, CheckIn>>>();

  private journeyStore(userId: string, journeyId: string): Map<string, CheckIn> {
    if (!this.store.has(userId)) this.store.set(userId, new Map());
    const u = this.store.get(userId)!;
    if (!u.has(journeyId)) u.set(journeyId, new Map());
    return u.get(journeyId)!;
  }

  async createCheckIn(userId: string, journeyId: string, scheduledAt: Date): Promise<CheckIn> {
    await delay(100);
    return this.writeCheckIn(newId(), userId, journeyId, scheduledAt);
  }

  async createCheckInWithId(
    userId: string,
    journeyId: string,
    checkInId: string,
    scheduledAt: Date,
  ): Promise<CheckIn> {
    await delay(100);
    return this.writeCheckIn(checkInId, userId, journeyId, scheduledAt);
  }

  private writeCheckIn(
    id: string,
    userId: string,
    journeyId: string,
    scheduledAt: Date,
  ): CheckIn {
    const checkIn: CheckIn = {
      id,
      journeyId,
      scheduledAt,
      respondedAt: null,
      status: 'PENDING',
      extendedByMinutes: null,
      createdAt: new Date(),
    };
    this.journeyStore(userId, journeyId).set(id, { ...checkIn });
    return { ...checkIn };
  }

  async updateCheckIn(
    userId: string,
    journeyId: string,
    checkInId: string,
    updates: CheckInUpdates,
  ): Promise<CheckIn> {
    await delay(100);
    const store = this.journeyStore(userId, journeyId);
    const existing = store.get(checkInId);
    if (!existing) throw new Error('Check-in not found.');
    const updated: CheckIn = { ...existing, ...updates };
    store.set(checkInId, { ...updated });
    return { ...updated };
  }

  async getLatestCheckIn(userId: string, journeyId: string): Promise<CheckIn | null> {
    await delay(50);
    const store = this.journeyStore(userId, journeyId);
    let latest: CheckIn | null = null;
    for (const c of store.values()) {
      if (!latest || c.createdAt > latest.createdAt) latest = c;
    }
    return latest ? { ...latest } : null;
  }
}
