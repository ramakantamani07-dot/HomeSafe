import type { SOSProvider } from '../../providers/SOSProvider';
import type { SOSEvent } from '../../models/SOS';
import type { Coordinates } from '../../models/Journey';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export class MockSOSProvider implements SOSProvider {
  // userId → sosId → SOSEvent
  private readonly store = new Map<string, Map<string, SOSEvent>>();

  private userStore(userId: string): Map<string, SOSEvent> {
    if (!this.store.has(userId)) this.store.set(userId, new Map());
    return this.store.get(userId)!;
  }

  async createSOS(
    userId: string,
    journeyId: string | null,
    location: Coordinates | null,
  ): Promise<SOSEvent> {
    await delay(150);
    return this.writeSOS(newId(), userId, journeyId, location);
  }

  async createSOSWithId(
    userId: string,
    sosId: string,
    journeyId: string | null,
    location: Coordinates | null,
  ): Promise<SOSEvent> {
    await delay(150);
    return this.writeSOS(sosId, userId, journeyId, location);
  }

  private writeSOS(
    id: string,
    userId: string,
    journeyId: string | null,
    location: Coordinates | null,
  ): SOSEvent {
    const now = new Date();
    const sos: SOSEvent = {
      id,
      userId,
      journeyId,
      location,
      status: 'ACTIVE',
      triggeredAt: now,
      resolvedAt: null,
      createdAt: now,
      duressTriggered: false,
    };
    this.userStore(userId).set(id, { ...sos });
    return { ...sos };
  }

  async resolveSOS(userId: string, sosId: string): Promise<SOSEvent> {
    await delay(100);
    const store = this.userStore(userId);
    const existing = store.get(sosId);
    if (!existing) throw new Error('SOS event not found.');
    const updated: SOSEvent = { ...existing, status: 'RESOLVED', resolvedAt: new Date() };
    store.set(sosId, { ...updated });
    return { ...updated };
  }

  async markDuress(userId: string, sosId: string): Promise<SOSEvent> {
    await delay(100);
    const store = this.userStore(userId);
    const existing = store.get(sosId);
    if (!existing) throw new Error('SOS event not found.');
    const updated: SOSEvent = { ...existing, duressTriggered: true };
    store.set(sosId, { ...updated });
    return { ...updated };
  }

  async getActiveSOS(userId: string): Promise<SOSEvent | null> {
    await delay(100);
    for (const sos of this.userStore(userId).values()) {
      if (sos.status === 'ACTIVE') return { ...sos };
    }
    return null;
  }
}
