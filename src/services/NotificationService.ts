import type { NotificationProvider } from '../providers/NotificationProvider';
import type { DeviceRegistryProvider } from '../providers/DeviceRegistryProvider';
import { SHARING_REVIEW_INTERVAL_DAYS } from '../models/AccountProtection';

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
 *
 * It also records this phone in the account's device list, with or without a
 * token, so a sign-in on a new phone warns the old one (account protection).
 */
export class NotificationService {
  constructor(
    private readonly notifications: NotificationProvider,
    private readonly devices: DeviceRegistryProvider,
  ) {}

  /**
   * Registers the device for push notifications and saves the FCM token
   * to Firestore under `users/{userId}`.
   *
   * Returns the token on success, null if permission is denied or the
   * device token is unavailable (e.g. iOS simulator, missing config).
   */
  async registerDevice(userId: string): Promise<string | null> {
    const granted = await this.notifications.requestPermission();
    const token = granted ? await this.notifications.getDeviceToken() : null;
    if (token) await this.notifications.saveDeviceToken(userId, token);
    if (granted) await this.notifications.ensureSharingReview(SHARING_REVIEW_INTERVAL_DAYS).catch(() => {});

    // Recorded even without push: the old phone is still told about this one,
    // and this one can be told about the next. A failure here must not cost
    // the push registration above.
    await this.devices.register(userId, token).catch(() => {});
    return token;
  }

  /** On sign-out: a reminder about someone else's family helps nobody. */
  async signedOut(): Promise<void> {
    await this.notifications.cancelSharingReview().catch(() => {});
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
      this.devices.register(userId, newToken).catch(() => {});
      onRefresh(newToken);
    });
  }
}
