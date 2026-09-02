import type { Coordinates } from '../models/Journey';
import type { TerminalJourneyStatus } from './JourneyProvider';
import type { CheckInStatus } from '../models/CheckIn';

// ─── Operation types (priority order: 1 = highest) ───────────────────────────

export type OperationType =
  | 'SOS_TRIGGER'        // P1 — create SOS event; saved locally immediately when offline
  | 'SOS_RESOLVE'        // P1 — mark active SOS as RESOLVED
  | 'MISSED_CHECKIN'     // P2 — set journey status to MISSED_CHECKIN
  | 'JOURNEY_STATUS'     // P3 — set journey status to COMPLETED | CANCELLED
  | 'JOURNEY_SOS_STATUS' // P3 — annotate journey with SOS_TRIGGERED (best-effort)
  | 'CHECKIN_CREATE'     // P4 — create check-in using client-generated ID
  | 'CHECKIN_UPDATE'     // P4 — update existing check-in record
  | 'NEXT_CHECKIN_AT'    // P4 — update nextCheckInAt field on journey document
  | 'LOCATION_UPDATE'    // P5 — compacted to MAX_LOCATION_UPDATES_PER_JOURNEY
  | 'PROFILE_UPDATE';    // P6 — local-only for now; no-op on sync

export type OperationStatus = 'pending' | 'failed';

// ─── Per-type payload shapes ──────────────────────────────────────────────────

export interface SosTriggerPayload {
  userId: string;
  journeyId: string | null;
  location: Coordinates | null;
  /** Pre-generated UUID used as the Firestore document ID on sync replay. */
  localSosId: string;
}

export interface SosResolvePayload {
  userId: string;
  /** The sosId known to the client (may be localSosId if triggered offline). */
  sosId: string;
}

export interface MissedCheckInPayload {
  userId: string;
  journeyId: string;
}

export interface JourneyStatusPayload {
  userId: string;
  journeyId: string;
  status: TerminalJourneyStatus;
}

export interface JourneySosStatusPayload {
  userId: string;
  journeyId: string;
}

export interface CheckInCreatePayload {
  userId: string;
  journeyId: string;
  scheduledAt: string;     // ISO string — original scheduled time
  localCheckInId: string;  // Pre-generated UUID used as Firestore document ID on sync
}

export interface CheckInUpdatePayload {
  userId: string;
  journeyId: string;
  checkInId: string;
  status: CheckInStatus;
  respondedAt: string | null; // ISO string
  extendedByMinutes: number | null;
}

export interface NextCheckInAtPayload {
  userId: string;
  journeyId: string;
  nextCheckInAt: string | null; // ISO string or null to clear
}

export interface LocationUpdatePayload {
  userId: string;
  journeyId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: string; // ISO string — original GPS timestamp
}

export interface ProfileUpdatePayload {
  userId: string;
  name?: string;
  photoURL?: string | null;
}

export type OperationPayload =
  | SosTriggerPayload
  | SosResolvePayload
  | MissedCheckInPayload
  | JourneyStatusPayload
  | JourneySosStatusPayload
  | CheckInCreatePayload
  | CheckInUpdatePayload
  | NextCheckInAtPayload
  | LocationUpdatePayload
  | ProfileUpdatePayload;

// ─── Queue item ───────────────────────────────────────────────────────────────

export interface QueuedOperation {
  /** Idempotency key — also used as the AsyncStorage array entry key. */
  id: string;
  type: OperationType;
  /** 1 = highest priority, 6 = lowest. */
  priority: number;
  payload: OperationPayload;
  /** ISO string — original event timestamp (preserved for Firestore writes). */
  originalTimestamp: string;
  /** ISO string — when this item was added to the queue. */
  enqueuedAt: string;
  retryCount: number;
  lastAttemptAt: string | null; // ISO string
  status: OperationStatus;
}

// ─── Provider interface ───────────────────────────────────────────────────────

export interface OfflineQueueProvider {
  /** Adds an item. Silently skips if an item with the same id already exists. */
  enqueue(item: QueuedOperation): Promise<void>;
  getAll(): Promise<QueuedOperation[]>;
  /** Removes a single item by id. No-op if not found. */
  remove(id: string): Promise<void>;
  /** Replaces an existing item (same id) in place. No-op if not found. */
  update(item: QueuedOperation): Promise<void>;
  /** Removes all items. Used in tests and sign-out cleanup. */
  clear(): Promise<void>;
}
