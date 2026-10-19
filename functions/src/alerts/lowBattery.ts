import * as logger from 'firebase-functions/logger';
import {
  onDocumentUpdated,
  type Change,
  type FirestoreEvent,
  type QueryDocumentSnapshot,
} from 'firebase-functions/v2/firestore';

import { db } from '../shared/firebase';
import { getAlertRecipients, sendAlerts } from '../shared/messaging';
import { metric } from '../shared/metrics';
import type { StoredJourney, StoredUser } from '../shared/types';
import { mapLink, textContacts } from './contactSms';

/**
 * "Battery under 10% → Send last location" (screen 04), kept.
 *
 * The phone writes `lowBattery` on its journey once, the first time the
 * battery drops below the journey's `alertRules.lowBatteryPercent`. This
 * sends the last location from here, not from the phone — a phone at 9% may
 * be off a minute later, and the point is that its last position is already
 * with someone when it is.
 *
 * It is a heads-up, not an alarm: the journey carries on and nothing else
 * changes. The same people as a safety check hear it (contacts who take
 * "something seems off" alerts), by push or text.
 */

export interface LowBatteryMark {
  percent: number;
}

/** The words, for push and text. Pure, so they are tested. */
export function lowBatteryMessage(
  name: string,
  destination: string,
  percent: number,
  location: { latitude: number; longitude: number } | null | undefined,
): { title: string; body: string; sms: string } {
  const link = mapLink(location);
  const lead = `${name}'s phone is at ${percent}% on the way to ${destination}.`;
  const after = 'If it runs out, their location will stop updating.';
  return {
    title: `🔋 ${name}'s battery is low`,
    body: link ? `${lead} Last location: ${link}. ${after}` : `${lead} ${after}`,
    sms: `wayLoc: ${lead}${link ? ` Last location: ${link}` : ''} ${after}`,
  };
}

type JourneyWithBattery = StoredJourney & { lowBattery?: LowBatteryMark | null };

export const onJourneyLowBattery = onDocumentUpdated(
  'users/{userId}/journeys/{journeyId}',
  async (
    event: FirestoreEvent<Change<QueryDocumentSnapshot> | undefined, { userId: string; journeyId: string }>,
  ) => {
    const { userId, journeyId } = event.params;
    const before = event.data?.before.data() as JourneyWithBattery | undefined;
    const after = event.data?.after.data() as JourneyWithBattery | undefined;
    if (!before || !after) return;
    // Only the edge into "low", once per journey, and only while it runs.
    if (before.lowBattery || !after.lowBattery) return;
    if (after.status !== 'ACTIVE') return;

    const user = (await db.doc(`users/${userId}`).get()).data() as StoredUser | undefined;
    const name = user?.name?.trim() || 'A contact';
    const destination = after.destinationLabel?.trim() || 'their destination';
    const percent = Math.round(after.lowBattery.percent);
    const message = lowBatteryMessage(name, destination, percent, after.currentLocation);

    const { tokens, sms } = await getAlertRecipients(userId, 'missedCheckIn');
    logger.info(`Low battery; notifying ${tokens.length} by push, ${sms.length} by text`, { journeyId });

    await textContacts(sms, 'contact-low-battery', message.sms);
    await sendAlerts(tokens, message.title, message.body, {
      type: 'LOW_BATTERY',
      userId,
      userName: name,
      journeyId,
      timestamp: new Date().toISOString(),
      location: after.currentLocation
        ? `${after.currentLocation.latitude.toFixed(5)},${after.currentLocation.longitude.toFixed(5)}`
        : '',
      battery: String(percent),
    });
    metric('low_battery_alert', { pushed: tokens.length, texted: sms.length });
  },
);
