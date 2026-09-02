/**
 * AccountDeletionProvider handles the Firestore side of account deletion.
 * The Firebase Auth account deletion is delegated to AuthProvider.deleteAuthAccount.
 *
 * NOTE: The Firestore Web SDK cannot recursively delete sub-collections in a
 * single call. This provider pages through sub-collections in batches of 200.
 * For users with very large journey histories, consider supplementing this
 * with a Cloud Function (Firebase Admin SDK) that deletes data server-side
 * and cleans up any orphaned sub-collection documents.
 */
export interface AccountDeletionProvider {
  /** Returns IDs of all journeys (any status) for the user. */
  listAllJourneyIds(userId: string): Promise<string[]>;

  /**
   * Deletes all locationUpdates and checkIns documents within a journey.
   * Does NOT delete the journey document itself — call deleteJourney after.
   */
  deleteJourneySubCollections(userId: string, journeyId: string): Promise<void>;

  /** Deletes a single journey document (does not touch sub-collections). */
  deleteJourney(userId: string, journeyId: string): Promise<void>;

  /** Deletes all contact documents for the user. */
  deleteAllContacts(userId: string): Promise<void>;

  /** Deletes all SOS event documents for the user. */
  deleteAllSosEvents(userId: string): Promise<void>;

  /** Deletes the root users/{userId} Firestore document. */
  deleteUserDocument(userId: string): Promise<void>;

  /**
   * Removes the FCM device token from the user document.
   * Best-effort — callers should swallow errors.
   */
  removeDeviceToken(userId: string): Promise<void>;
}
