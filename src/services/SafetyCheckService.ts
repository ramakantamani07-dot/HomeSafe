import type { Coordinates } from '../models/Journey';
import type { AlertRules, SafetyCheckReason } from '../models/AlertRules';
import type { SafetyCheck } from '../models/SafetyCheck';
import { STOPPED_RADIUS_METERS } from '../models/SafetyCheck';
import { haversineMeters } from '../models/Place';
import type { SafetyCheckProvider } from '../providers/SafetyCheckProvider';

/** One tracked position, kept only long enough to decide "has this person moved". */
export interface PositionSample {
  coordinates: Coordinates;
  at: Date;
}

export interface DetectionInput {
  /** Recent positions, oldest first. */
  samples: PositionSample[];
  /** Expected arrival, adjusted by any "Add 15 min" extensions. Null when unknown. */
  eta: Date | null;
  /** Straight-line metres from the nearest point of the planned route. Null when unrouted. */
  offRouteMeters: number | null;
  rules: AlertRules;
  now: Date;
}

/** Distance from the route beyond which the traveller is treated as off it. */
const OFF_ROUTE_THRESHOLD_METERS = 300;

/**
 * If the newest position is older than this, the location feed is treated as
 * dead and no "stopped" conclusion is drawn from it. Comfortably above the
 * slowest real cadence — JOURNEY mode while stationary and low on battery
 * reports every 2 minutes.
 */
const STALE_FEED_MS = 3 * 60_000;

export class SafetyCheckService {
  constructor(private readonly checks: SafetyCheckProvider) {}

  /**
   * Decides whether a safety check is warranted right now, and why.
   *
   * Pure and side-effect free so the thresholds can be tested directly
   * without a journey, a clock, or a provider. Returns null when everything
   * looks normal — the common case, evaluated on every location update.
   *
   * Order matters: "stopped" is checked before "late" because a traveller who
   * has stopped is both, and "you've been stopped for 10 minutes" tells them
   * something far more actionable than "you're running late".
   */
  detect(input: DetectionInput): SafetyCheckReason | null {
    const { samples, eta, offRouteMeters, rules, now } = input;

    if (this.isStopped(samples, rules.stoppedMinutes, now)) return 'stopped';

    if (eta && now.getTime() > eta.getTime() + rules.lateMinutes * 60_000) return 'late';

    if (offRouteMeters !== null && offRouteMeters > OFF_ROUTE_THRESHOLD_METERS) {
      return 'off-route';
    }

    return null;
  }

  /**
   * True when every sample within the last `minutes` sits inside a small
   * radius of the newest one.
   *
   * Two guards keep this honest, and both matter more than the radius check
   * itself:
   *
   *  - The feed must be alive. A phone that stopped *reporting* half an hour
   *    ago is a connectivity problem, not a stationary traveller, and telling
   *    someone "you've been stopped for 10 minutes" when we simply don't know
   *    is a lie they'll learn to dismiss.
   *  - There must be history older than the window. Otherwise a journey that
   *    started 90 seconds ago would satisfy a 10-minute threshold on two
   *    samples.
   *
   * Sample cadence is deliberately not assumed: tracking drops to a 2-minute
   * interval when stationary and low on battery (see TrackingConfig), so a
   * rule keyed to "a sample every minute" would never fire in exactly the
   * conditions it's meant to catch.
   */
  private isStopped(samples: PositionSample[], minutes: number, now: Date): boolean {
    if (samples.length < 2) return false;

    const cutoff = now.getTime() - minutes * 60_000;

    const latest = samples[samples.length - 1];
    if (now.getTime() - latest.at.getTime() > STALE_FEED_MS) return false;

    // Oldest sample overall — history must reach back past the window start.
    if (samples[0].at.getTime() > cutoff) return false;

    const inWindow = samples.filter((s) => s.at.getTime() >= cutoff);
    if (inWindow.length < 2) return false;

    return inWindow.every(
      (s) => haversineMeters(s.coordinates, latest.coordinates) <= STOPPED_RADIUS_METERS,
    );
  }

  /**
   * Records a raised safety check, stamped with the deadline at which
   * guardians get alerted if nobody answers.
   *
   * The deadline is persisted rather than kept in memory so the server can
   * enforce it — see escalateOverdueSafetyChecks in functions/. A client-only
   * deadline is lost the moment the app is killed.
   */
  raise(
    userId: string,
    journeyId: string,
    reason: SafetyCheckReason,
    location: Coordinates | null,
    rules: AlertRules,
    now: Date = new Date(),
  ): Promise<SafetyCheck> {
    const escalateAt = new Date(now.getTime() + rules.noReplyMinutes * 60_000);
    return this.checks.createSafetyCheck(userId, journeyId, reason, location, escalateAt);
  }

  confirm(userId: string, journeyId: string, checkId: string): Promise<void> {
    return this.checks.resolveSafetyCheck(userId, journeyId, checkId, 'CONFIRMED', null);
  }

  extend(
    userId: string,
    journeyId: string,
    checkId: string,
    minutes: number,
  ): Promise<void> {
    return this.checks.resolveSafetyCheck(userId, journeyId, checkId, 'EXTENDED', minutes);
  }

  /** Alerts guardians. The journey deliberately stays ACTIVE — see SafetyCheck. */
  escalate(
    userId: string,
    journeyId: string,
    checkId: string,
    location: Coordinates | null,
    batteryPercent: number | null,
  ): Promise<void> {
    return this.checks.escalateSafetyCheck(userId, journeyId, checkId, location, batteryPercent);
  }
}
