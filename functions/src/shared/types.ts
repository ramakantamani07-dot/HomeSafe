import type { Timestamp } from 'firebase-admin/firestore';

/**
 * Firestore document shapes, mirroring the client-side models in `src/models/`.
 *
 * Deliberately duplicated rather than imported: `functions/` is a separate
 * TypeScript project with its own tsconfig and dependency tree, and shares no
 * module graph with the app. Keep these in sync by hand when a stored shape
 * changes — a shared package would cost more than it saves at this size.
 */

export interface StoredSOS {
  userId: string;
  journeyId: string | null;
  location: { latitude: number; longitude: number } | null;
  status: 'ACTIVE' | 'RESOLVED';
  triggeredAt: Timestamp;
}

export interface StoredJourney {
  status: string;
  destinationLabel: string;
  /** Latest tracked position. Absent until the first location update lands. */
  currentLocation?: { latitude: number; longitude: number };
}

export interface StoredContact {
  name: string;
  phone: string;
}

export interface StoredUser {
  name?: string;
  phone?: string;
  fcmToken?: string;
}

export interface StoredSafetyCheck {
  journeyId: string;
  reason: 'late' | 'stopped' | 'off-route';
  status: 'PENDING' | 'CONFIRMED' | 'EXTENDED' | 'ESCALATED';
  raisedAt: Timestamp;
  escalatedAt: Timestamp | null;
  location: { latitude: number; longitude: number } | null;
  batteryPercent: number | null;
}

// FCM data values must all be strings.
export interface AlertData {
  type: 'SOS_TRIGGERED' | 'MISSED_CHECKIN' | 'SAFETY_CHECK_ESCALATED';
  userId: string;
  userName: string;
  journeyId: string;
  timestamp: string;
  location: string; // "lat,lng" or "" when unknown
  /** Present only on SAFETY_CHECK_ESCALATED. "" when the battery is unknown. */
  battery?: string;
}
