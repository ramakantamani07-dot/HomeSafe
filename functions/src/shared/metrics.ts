import * as logger from 'firebase-functions/logger';

/**
 * Structured metrics as log lines (Phase 8).
 *
 * Each call writes one JSON log entry with `metric: <name>`; Cloud Logging
 * turns those into log-based metrics (counters and distributions) and alerts
 * with no extra infrastructure and no new dependency. Field names are the
 * contract — a dashboard reads `jsonPayload.metric` and the fields below.
 *
 * **Never personal data.** No phone numbers, no coordinates, no names: ids at
 * most, and usually not even those.
 */
export type MetricName =
  | 'locate'               // outcome, reason, latencyMs, failure, billedUnits
  | 'zone_check'           // outcome, latencyMs, event, billedUnits
  | 'member_sos'           // source, guardians, reached, deliveryMs
  | 'member_checkin'       // guardians
  | 'consent_transition'   // from, to, trigger
  | 'ask_ok'               // delivered
  | 'push_failed';         // kind, code

export function metric(name: MetricName, fields: Record<string, string | number | boolean | null>): void {
  logger.info(`metric:${name}`, { metric: name, ...fields });
}
