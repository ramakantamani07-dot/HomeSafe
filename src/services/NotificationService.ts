import type { NotificationProvider } from '../providers/NotificationProvider';

/**
 * Manages push notification token registration.
 *
 * The token lifecycle on each app launch:
 *   1. Request OS permission (no-op if already granted/denied).
 *   2. Fetch the device's native FCM/APNs token.
 *   3. Persist it to the user's Firestore profile.
 *
 * Cloud Functions read the persisted token to deliver SOS and missed
 * check-in alerts to the user's trusted contacts.
 */
export class NotificationService {
  constructor(private readonly notifications: NotificationProvider) {}

  /**
   * Registers the device for push notifications and saves the FCM token
   * to Firestore under `users/{userId}`.
   *
   * Returns the token on success, null if permission is denied or the
   * device token is unavailable (e.g. iOS simulator, missing config).
   */
  async registerDevice(userId: string): Promise<string | null> {
    const granted = await this.notifications.requestPermission();
    if (!granted) return null;

    const token = await this.notifications.getDeviceToken();
    if (!token) return null;

    await this.notifications.saveDeviceToken(userId, token);
    return token;
  }

  /**
   * Subscribes to mid-session FCM token rotations for the given user.
   * When the OS issues a new token, it is saved to Firestore automatically
   * and `onRefresh` is called with the new token value.
   *
   * Returns an unsubscribe function — MUST be called on cleanup.
   */
  watchTokenRefresh(userId: string, onRefresh: (newToken: string) => void): () => void {
    return this.notifications.onTokenRefresh((newToken) => {
      this.notifications.saveDeviceToken(userId, newToken).catch(() => {});
      onRefresh(newToken);
    });
  }
}
