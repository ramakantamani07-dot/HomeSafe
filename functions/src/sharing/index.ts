import { onRequest } from 'firebase-functions/v2/https';
import type { Timestamp } from 'firebase-admin/firestore';

import { db } from '../shared/firebase';

/**
 * The public guardian tracking link — the one endpoint reachable without an
 * account, backing the tracking page in wayloc-web.
 */

// Mirrors src/models/JourneyShare.ts's SharedJourneyView — duplicated because
// functions/ is a separate project with its own tsconfig and doesn't share
// imports with src/. Keep in sync if either shape changes.
interface SharedJourneyView {
  found: boolean;
  active: boolean;
  displayName: string | null;
  destinationLabel: string | null;
  eta: string | null;
  status: 'TRAVELLING' | 'ARRIVED' | 'ENDED' | null;
}

interface StoredJourneyShare {
  userId: string;
  journeyId: string;
  displayName: string;
}

function notFoundResponse(displayName: string | null = null): SharedJourneyView {
  return { found: false, active: false, displayName, destinationLabel: null, eta: null, status: null };
}

/**
 * Public HTTPS endpoint backing the guardian tracking page in wayloc-web.
 * Deliberately the *only* path that ever resolves a share token — anonymous
 * clients never read Firestore directly (firestore.rules keeps
 * journeyShares owner-only), and this is also the only place that checks
 * whether the linked journey is still ACTIVE: a share document's mere
 * existence never implies it's still valid, its linked journey's live
 * status is the actual source of truth, checked fresh on every request.
 *
 * Never returns live GPS coordinates — see models/JourneyShare.ts for why
 * that's a deliberate v1 scope limit, not an oversight.
 */
export const getSharedJourney = onRequest({ cors: true }, async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  if (!token) {
    res.status(400).json(notFoundResponse());
    return;
  }

  const shareSnap = await db.collection('journeyShares').doc(token).get();
  if (!shareSnap.exists) {
    res.status(200).json(notFoundResponse());
    return;
  }
  const share = shareSnap.data() as StoredJourneyShare;

  const journeySnap = await db.doc(`users/${share.userId}/journeys/${share.journeyId}`).get();
  if (!journeySnap.exists) {
    res.status(200).json(notFoundResponse(share.displayName));
    return;
  }
  const journey = journeySnap.data() as {
    status: string;
    destinationLabel: string;
    initialEta: Timestamp | null;
  };

  const active = journey.status === 'ACTIVE';
  const status: SharedJourneyView['status'] =
    journey.status === 'ACTIVE' ? 'TRAVELLING' : journey.status === 'COMPLETED' ? 'ARRIVED' : 'ENDED';

  const view: SharedJourneyView = {
    found: true,
    active,
    displayName: share.displayName,
    destinationLabel: journey.destinationLabel,
    eta: journey.initialEta ? journey.initialEta.toDate().toISOString() : null,
    status,
  };
  res.status(200).json(view);
});
