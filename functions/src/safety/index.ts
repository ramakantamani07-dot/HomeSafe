import * as logger from 'firebase-functions/logger';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp, type QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { db } from '../shared/firebase';
import type { StoredJourney } from '../shared/types';

/**
 * Server-side enforcement of the safety-check escalation deadline.
 *
 * The client raises a safety check and counts down to `escalateAt`, but the
 * client is exactly what cannot be relied on here. The app can be force-quit,
 * killed by the OS under memory pressure, or lose its JS runtime while the
 * phone keeps delivering background location — and a terminated app relaunched
 * headlessly for a location event has no React tree, so nothing is watching the
 * deadline at all. Worst of all, a flat battery takes the countdown with it.
 *
 * Every one of those is a case where a guardian most needs to hear from us.
 * This function is the half of escalation that survives them, because it runs
 * nowhere near the device.
 *
 * It only flips the status. The existing onSafetyCheckEscalated trigger reacts
 * to that same edge and sends the alert, whether the client wrote it or this
 * did — detection and notification stay separate, and the client racing this
 * function is harmless because both converge on one PENDING → ESCALATED edge.
 */

/**
 * Every minute. The default reply window is two minutes, so a coarser schedule
 * would be a meaningful fraction of the window itself — a guardian waiting to
 * hear that someone is unresponsive should not also wait on our cron. One
 * indexed collection-group query per minute is negligible next to that.
 */
export const escalateOverdueSafetyChecks = onSchedule('every 1 minutes', async () => {
  const now = Timestamp.now();

  const overdue = await db
    .collectionGroup('safetyChecks')
    .where('status', '==', 'PENDING')
    .where('escalateAt', '<=', now)
    .get();

  if (overdue.empty) return;

  logger.info(`escalateOverdueSafetyChecks: escalating ${overdue.size} unanswered check(s)`);

  await Promise.allSettled(
    overdue.docs.map(async (doc: QueryDocumentSnapshot) => {
      // The journey carries the freshest position the device managed to report
      // before it went quiet. That is more useful to a guardian than the
      // location captured when the check was first raised, which may be minutes
      // stale by now.
      const journeyRef = doc.ref.parent.parent;
      const journey = journeyRef
        ? ((await journeyRef.get()).data() as StoredJourney | undefined)
        : undefined;

      await doc.ref.update({
        status: 'ESCALATED',
        escalatedAt: now,
        ...(journey?.currentLocation ? { location: journey.currentLocation } : {}),
        // Battery is only known to the client. Leaving it untouched keeps
        // whatever the client last wrote rather than overwriting it with a
        // guess — the alert copy already treats it as optional.
      });
    }),
  );
});
