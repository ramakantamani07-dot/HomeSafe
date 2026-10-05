import type { Coordinates } from '../../models/Journey';
import type { SafetyCheck } from '../../models/SafetyCheck';
import type { SafetyCheckReason } from '../../models/AlertRules';
import type { SafetyCheckProvider } from '../../providers/SafetyCheckProvider';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class MockSafetyCheckProvider implements SafetyCheckProvider {
  private store = new Map<string, SafetyCheck>();
  private nextId = 1;

  async createSafetyCheck(
    _userId: string,
    journeyId: string,
    reason: SafetyCheckReason,
    location: Coordinates | null,
    escalateAt: Date,
  ): Promise<SafetyCheck> {
    await delay(100);
    const check: SafetyCheck = {
      id: `mock-safety-${this.nextId++}`,
      journeyId,
      reason,
      status: 'PENDING',
      raisedAt: new Date(),
      escalateAt,
      respondedAt: null,
      escalatedAt: null,
      location: location ? { ...location } : null,
      batteryPercent: null,
      extendedByMinutes: null,
    };
    this.store.set(check.id, check);
    return { ...check };
  }

  async resolveSafetyCheck(
    _userId: string,
    _journeyId: string,
    checkId: string,
    status: 'CONFIRMED' | 'EXTENDED',
    extendedByMinutes: number | null,
  ): Promise<void> {
    await delay(100);
    const existing = this.store.get(checkId);
    if (!existing) return;
    this.store.set(checkId, {
      ...existing,
      status,
      respondedAt: new Date(),
      extendedByMinutes,
    });
  }

  async escalateSafetyCheck(
    _userId: string,
    _journeyId: string,
    checkId: string,
    location: Coordinates | null,
    batteryPercent: number | null,
  ): Promise<void> {
    await delay(100);
    const existing = this.store.get(checkId);
    if (!existing) return;
    this.store.set(checkId, {
      ...existing,
      status: 'ESCALATED',
      escalatedAt: new Date(),
      location: location ?? existing.location,
      batteryPercent,
    });
  }
}
