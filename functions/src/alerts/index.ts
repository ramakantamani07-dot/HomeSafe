import * as logger from 'firebase-functions/logger';
import {
  onDocumentCreated,
  onDocumentUpdated,
  type FirestoreEvent,
  type QueryDocumentSnapshot as FunctionsQueryDocumentSnapshot,
  type Change,
} from 'firebase-functions/v2/firestore';
import { Timestamp } from 'firebase-admin/firestore';

import { db } from '../shared/firebase';
import { getContactFcmTokens, sendAlerts } from '../shared/messaging';
import type {
  StoredJourney,
  StoredSOS,
  StoredSafetyCheck,
  StoredUser,
} from '../shared/types';

/**
 * Guardian alerting.
 *
 * All three triggers share one contract: a Firestore write is the interface.
 * The client never calls a notification API — it writes a document, and the
 * edge into an alerting state is what fans out. That keeps security rules as
 * the enforcement point and makes every alert replayable from data.
 */

/**
 * Fires when a user triggers SOS.
 * Notifies all trusted contacts who have wayLoc installed.
 *
 * Payload delivered to contacts:
 *   type          : "SOS_TRIGGERED"
 *   userId        : UID of the user who triggered SOS
 *   userName      : display name of that user
 *   journeyId     : active journey ID at trigger time, or ""
 *   timestamp     : ISO-8601 trigger time
 *   location      : "lat,lng" of last known location, or ""
 */
export const onSOSTriggered = onDocumentCreated(
  'users/{userId}/sosEvents/{sosId}',
  async (event: FirestoreEvent<FunctionsQueryDocumentSnapshot | undefined, { userId: string; sosId: string }>) => {
    const { userId, sosId } = event.params;
    const sos = event.data?.data() as StoredSOS | undefined;
    if (!sos || sos.status !== 'ACTIVE') return;

    const userDoc = await db.doc(`users/${userId}`).get();
    const user = userDoc.data() as StoredUser | undefined;
    const userName = user?.name?.trim() || 'A contact';

    const location = sos.location
      ? `${sos.location.latitude.toFixed(5)},${sos.location.longitude.toFixed(5)}`
      : '';

    const tokens = await getContactFcmTokens(userId);

    logger.info(
      `SOS triggered by user ${userId} (${userName}); notifying ${tokens.length} contacts`,
      { sosId },
    );

    await sendAlerts(
      tokens,
      '🚨 SOS Alert',
      location
        ? `${userName} has triggered an SOS! Last known location: ${location}`
        : `${userName} has triggered an SOS alert!`,
      {
        type: 'SOS_TRIGGERED',
        userId,
        userName,
        journeyId: sos.journeyId ?? '',
        timestamp: sos.triggeredAt.toDate().toISOString(),
        location,
      },
    );
  },
);

/**
 * Fires when a journey document is updated.
 * Sends a missed check-in alert to contacts when status transitions to
 * MISSED_CHECKIN — exactly once, on the status change edge.
 *
 * Payload delivered to contacts:
 *   type          : "MISSED_CHECKIN"
 *   userId        : UID of the user who missed the check-in
 *   userName      : display name of that user
 *   journeyId     : the journey that was missed
 *   timestamp     : ISO-8601 time of status change
 *   location      : "" (no live location at check-in miss time in this phase)
 */
export const onMissedCheckIn = onDocumentUpdated(
  'users/{userId}/journeys/{journeyId}',
  async (event: FirestoreEvent<Change<FunctionsQueryDocumentSnapshot> | undefined, { userId: string; journeyId: string }>) => {
    const { userId, journeyId } = event.params;
    const before = event.data?.before.data() as StoredJourney | undefined;
    const after = event.data?.after.data() as StoredJourney | undefined;

    if (!before || !after) return;
    // Only act on the edge: not-MISSED_CHECKIN → MISSED_CHECKIN
    if (before.status === 'MISSED_CHECKIN') return;
    if (after.status !== 'MISSED_CHECKIN') return;

    const userDoc = await db.doc(`users/${userId}`).get();
    const user = userDoc.data() as StoredUser | undefined;
    const userName = user?.name?.trim() || 'A contact';

    const tokens = await getContactFcmTokens(userId);

    logger.info(
      `Missed check-in for user ${userId} on journey ${journeyId}; notifying ${tokens.length} contacts`,
    );

    await sendAlerts(
      tokens,
      '⚠️ Missed Check-in',
      `${userName} missed their safety check-in on a journey to ${after.destinationLabel}.`,
      {
        type: 'MISSED_CHECKIN',
        userId,
        userName,
        journeyId,
        timestamp: new Date().toISOString(),
        location: '',
      },
    );
  },
);

/**
 * Fires when an automatic safety check (screen 08) goes unanswered.
 *
 * The client raises a safetyCheck document as PENDING, counts down the
 * traveller's reply window locally, and flips it to ESCALATED when that window
 * closes. This function watches for exactly that edge.
 *
 * The journey deliberately stays ACTIVE throughout — unlike a missed interval
 * check-in, which ends it. Guardians are being alerted *because* they need the
 * traveller's live location, and ending the journey would stop producing it at
 * the precise moment it matters most.
 *
 * Payload delivered to contacts:
 *   type          : "SAFETY_CHECK_ESCALATED"
 *   userId        : UID of the traveller
 *   userName      : display name of that traveller
 *   journeyId     : the journey the check was raised on
 *   timestamp     : ISO-8601 escalation time
 *   location      : "lat,lng" at escalation, or ""
 *   battery       : battery percentage as a string, or ""
 */
export const onSafetyCheckEscalated = onDocumentUpdated(
  'users/{userId}/journeys/{journeyId}/safetyChecks/{safetyCheckId}',
  async (event: FirestoreEvent<Change<FunctionsQueryDocumentSnapshot> | undefined, { userId: string; journeyId: string; safetyCheckId: string }>) => {
    const { userId, journeyId, safetyCheckId } = event.params;
    const before = event.data?.before.data() as StoredSafetyCheck | undefined;
    const after = event.data?.after.data() as StoredSafetyCheck | undefined;

    if (!before || !after) return;
    // Only the not-ESCALATED → ESCALATED edge, so a later edit can't re-alert.
    if (before.status === 'ESCALATED') return;
    if (after.status !== 'ESCALATED') return;

    const [userDoc, journeyDoc] = await Promise.all([
      db.doc(`users/${userId}`).get(),
      db.doc(`users/${userId}/journeys/${journeyId}`).get(),
    ]);

    const user = userDoc.data() as StoredUser | undefined;
    const journey = journeyDoc.data() as StoredJourney | undefined;
    const userName = user?.name?.trim() || 'A contact';
    const destination = journey?.destinationLabel?.trim() || 'their destination';

    const location = after.location
      ? `${after.location.latitude.toFixed(5)},${after.location.longitude.toFixed(5)}`
      : '';
    const battery = after.batteryPercent !== null && after.batteryPercent !== undefined
      ? String(after.batteryPercent)
      : '';

    const reasonText =
      after.reason === 'stopped'
        ? 'stopped for a while'
        : after.reason === 'late'
          ? 'running late'
          : 'moved off their route';

    const tokens = await getContactFcmTokens(userId);

    logger.info(
      `Safety check escalated for user ${userId} on journey ${journeyId}; notifying ${tokens.length} contacts`,
      { safetyCheckId, reason: after.reason },
    );

    await sendAlerts(
      tokens,
      `⚠️ Check on ${userName}`,
      location
        ? `${userName} is ${reasonText} on the way to ${destination} and hasn't replied. Last location: ${location}${battery ? ` · battery ${battery}%` : ''}`
        : `${userName} is ${reasonText} on the way to ${destination} and hasn't replied.`,
      {
        type: 'SAFETY_CHECK_ESCALATED',
        userId,
        userName,
        journeyId,
        timestamp: (after.escalatedAt ?? Timestamp.now()).toDate().toISOString(),
        location,
        battery,
      },
    );
  },
);
