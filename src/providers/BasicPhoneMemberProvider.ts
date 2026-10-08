import type { BasicPhoneMember, NewBasicPhoneMember } from '../models/BasicPhoneMember';
import type { Consent, ResendOutcome } from '../models/Consent';
import type { LocateAudit } from '../models/LocateAudit';

/**
 * The guardian's side of basic-phone members: the people, their consent, and
 * the record of every time someone looked.
 *
 * Separate from `NetworkLocationProvider`, which performs lookups. These are
 * two different trust levels — this port reads and writes the guardian's own
 * documents under the Firestore rules; that one asks a Cloud Function to do
 * something the guardian is not allowed to do directly.
 *
 * Members and consent are **subscriptions**, not reads. Spec §10: "the guardian
 * sees the status change immediately" when a member texts STOP. A list that
 * only refreshed on pull would show someone as findable after they had asked
 * not to be.
 */
export interface BasicPhoneMemberProvider {
  subscribeMembers(ownerId: string, onChange: (members: BasicPhoneMember[]) => void): () => void;

  /**
   * Adds someone and asks for their consent, in one write: the member and a
   * `PENDING_SMS` consent are created together, and the server texts them.
   * Nothing is shared until they reply YES and their operator agrees.
   */
  addMember(ownerId: string, input: NewBasicPhoneMember): Promise<BasicPhoneMember>;

  subscribeConsent(
    ownerId: string,
    memberId: string,
    onChange: (consent: Consent | null) => void,
  ): () => void;

  /**
   * Revokes consent — the one consent transition a client may make (D17).
   *
   * Never waits on the network: it is a local write that syncs when it can, so
   * "Stop finding" works on a phone with no signal. The server's cleanup
   * follows when it lands (revocation layer 3).
   */
  stopFinding(ownerId: string, memberId: string): Promise<void>;

  /**
   * Texts the consent request again, if the server's limit allows. Never
   * throws: every outcome is something the screen explains.
   */
  resendRequest(ownerId: string, memberId: string): Promise<ResendOutcome>;

  /** The most recent lookups of one member, newest first, refused ones included. */
  listFinds(ownerId: string, memberId: string, limit: number): Promise<LocateAudit[]>;
}
