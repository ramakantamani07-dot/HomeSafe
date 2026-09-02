import type { AccountDeletionProvider } from '../providers/AccountDeletionProvider';
import type { AuthProvider } from '../providers/AuthProvider';
import type { OfflineQueueProvider } from '../providers/OfflineQueueProvider';
import type { StorageProvider } from '../providers/StorageProvider';

export interface AccountDeletionResult {
  success: boolean;
  /** True when Firebase requires the user to sign in again before deletion. */
  requiresRecentAuth: boolean;
  /** IDs of data items that could not be deleted (logged for diagnostics). */
  partialErrors: string[];
  error?: string;
}

function isRecentAuthError(err: unknown): boolean {
  return (
    err != null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: unknown }).code === 'auth/requires-recent-login'
  );
}

/**
 * Orchestrates permanent account deletion in a safe, ordered sequence:
 *   1. Remove device FCM token (best-effort)
 *   2. Delete all Firestore journey sub-collections then journey documents
 *   3. Delete contacts and SOS events
 *   4. Delete user Firestore document
 *   5. Clear offline queue and local user data
 *   6. Delete Firebase Auth account LAST (auth is needed for Firestore steps 2–4)
 *
 * Firestore writes use the user's own auth token, so Firestore data MUST be
 * deleted before the auth account is removed. If the auth deletion fails with
 * auth/requires-recent-login, the Firestore data has already been removed —
 * the user must sign in again and retry to complete the auth-account deletion.
 */
export class AccountDeletionService {
  constructor(
    private readonly deletionProvider: AccountDeletionProvider,
    private readonly authProvider: AuthProvider,
    private readonly queueProvider: OfflineQueueProvider,
    private readonly storageProvider: StorageProvider,
  ) {}

  async deleteAccount(userId: string): Promise<AccountDeletionResult> {
    const partialErrors: string[] = [];

    // 1. Remove device token so push notifications stop immediately.
    await this.deletionProvider.removeDeviceToken(userId).catch(() => {});

    // 2. Delete journey data (sub-collections must come before parent documents).
    let journeyIds: string[] = [];
    try {
      journeyIds = await this.deletionProvider.listAllJourneyIds(userId);
    } catch {
      partialErrors.push('journeys-list');
    }

    for (const jId of journeyIds) {
      await this.deletionProvider
        .deleteJourneySubCollections(userId, jId)
        .catch(() => partialErrors.push(`sub:${jId}`));
      await this.deletionProvider
        .deleteJourney(userId, jId)
        .catch(() => partialErrors.push(`journey:${jId}`));
    }

    // 3. Delete contacts.
    await this.deletionProvider.deleteAllContacts(userId)
      .catch(() => partialErrors.push('contacts'));

    // 4. Delete SOS events.
    await this.deletionProvider.deleteAllSosEvents(userId)
      .catch(() => partialErrors.push('sos'));

    // 5. Delete root user document.
    await this.deletionProvider.deleteUserDocument(userId)
      .catch(() => partialErrors.push('user-doc'));

    // 6. Clear local data — offline queue and SecureStore user profile.
    await this.queueProvider.clear().catch(() => partialErrors.push('queue'));
    await this.storageProvider.deleteUser?.(userId).catch(() => partialErrors.push('local'));

    // 7. Delete Firebase Auth account LAST.
    //    Auth token is required for Firestore operations above; deleting it first
    //    would cause all subsequent Firestore writes to fail with permission-denied.
    try {
      await this.authProvider.deleteAuthAccount();
      return { success: true, requiresRecentAuth: false, partialErrors };
    } catch (err) {
      return {
        success: false,
        requiresRecentAuth: isRecentAuthError(err),
        partialErrors,
        error: err instanceof Error ? err.message : 'Account deletion failed.',
      };
    }
  }
}
