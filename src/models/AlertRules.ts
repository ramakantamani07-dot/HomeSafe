/**
 * The "If something seems off" block on screen 04, and the thresholds the
 * safety check (screen 08) actually fires on.
 *
 * Defaults come straight from JOURNEY_FLOW_SPEC §3 ("Journey start"): ask if
 * OK when 10 min late or stopped 10 min; alert guardians if no reply in 2
 * min; send last location when battery < 10%.
 */
export interface AlertRules {
  /** Minutes behind the ETA before a safety check is raised. */
  lateMinutes: number;
  /** Minutes stationary before a safety check is raised. */
  stoppedMinutes: number;
  /** Minutes the user has to answer a safety check before guardians are alerted. */
  noReplyMinutes: number;
  /** Battery percentage below which the last known location is sent. */
  lowBatteryPercent: number;
}

export const DEFAULT_ALERT_RULES: AlertRules = {
  lateMinutes: 10,
  stoppedMinutes: 10,
  noReplyMinutes: 2,
  lowBatteryPercent: 10,
};

/** Choices offered by the "Edit" link on screen 04. */
export const LATE_THRESHOLD_OPTIONS = [5, 10, 15, 30] as const;
export const NO_REPLY_OPTIONS = [1, 2, 5] as const;

/** Why a safety check was raised — drives the explanation line on screen 08. */
export type SafetyCheckReason = 'late' | 'stopped' | 'off-route';

export function describeSafetyCheckReason(
  reason: SafetyCheckReason,
  rules: AlertRules,
  nearPlace: string | null,
): string {
  const where = nearPlace ? ` near ${nearPlace}` : '';
  switch (reason) {
    case 'stopped':
      return `You've been stopped for ${rules.stoppedMinutes} minutes${where}. That can be normal — just let us know.`;
    case 'late':
      return `You're about ${rules.lateMinutes} minutes behind${where}. That can be normal — just let us know.`;
    case 'off-route':
      return `You've moved away from your route${where}. That can be normal — just let us know.`;
  }
}
