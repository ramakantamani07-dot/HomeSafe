import type { Coordinates } from '../models/Journey';
import type { SafetyCheck } from '../models/SafetyCheck';
import type { SafetyCheckReason } from '../models/AlertRules';

export interface SafetyCheckProvider {
  /** Records a newly raised safety check (screen 08 appearing). */
  createSafetyCheck(
    userId: string,
    journeyId: string,
    reason: SafetyCheckReason,
    location: Coordinates | null,
    escalateAt: Date,
  ): Promise<SafetyCheck>;

  /** "I'm OK — carry on" / "Add 15 min". */
  resolveSafetyCheck(
    userId: string,
    journeyId: string,
    checkId: string,
    status: 'CONFIRMED' | 'EXTENDED',
    extendedByMinutes: number | null,
  ): Promise<void>;

  /**
   * No reply within the window. Writing this is what alerts the guardians —
   * a Cloud Function watches for it (see functions/src/index.ts,
   * onSafetyCheckEscalated) and pushes to every linked contact. The journey
   * itself stays ACTIVE so guardians keep receiving live location.
   */
  escalateSafetyCheck(
    userId: string,
    journeyId: string,
    checkId: string,
    location: Coordinates | null,
    batteryPercent: number | null,
  ): Promise<void>;
}
