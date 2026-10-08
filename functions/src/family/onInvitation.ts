import * as logger from 'firebase-functions/logger';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

import { db, messaging } from '../shared/firebase';
import { isDeadTokenError } from '../shared/messaging';
import type { StoredUser } from '../shared/types';

interface StoredInvitation {
  fromDisplayName: string;
  toPhone: string;
  status: string;
}

/**
 * Tells the person invited, if they have wayLoc (Phase 5b, Invite sent).
 *
 * Without this, "she'll get a notification" on the Invite sent screen would be
 * untrue: invitations were only ever seen by opening the app. Someone without
 * an account is not texted — no SMS provider exists yet (decision F2) — and
 * the screen says so.
 */
export const onFamilyInvitationCreated = onDocumentCreated(
  'familyInvitations/{invitationId}',
  async (event) => {
    const invitation = event.data?.data() as StoredInvitation | undefined;
    if (!invitation || invitation.status !== 'PENDING') return;

    const match = await db.collection('users').where('phone', '==', invitation.toPhone).limit(1).get();
    const invitee = match.docs[0];
    const token = (invitee?.data() as StoredUser | undefined)?.fcmToken?.trim();
    if (!invitee || !token) return;

    const from = invitation.fromDisplayName?.trim() || 'Someone';
    try {
      await messaging.send({
        token,
        notification: {
          title: `${from} invited you to their family`,
          body: 'Open wayLoc to accept or decline.',
        },
        data: { type: 'FAMILY_INVITATION', invitationId: event.params.invitationId },
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (isDeadTokenError(code)) await invitee.ref.update({ fcmToken: '' }).catch(() => {});
      logger.warn('Invitation push failed', { code });
    }
  },
);
