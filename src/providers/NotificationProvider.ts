export interface NotificationProvider {
  /**
   * Requests OS push notification permission.
   * Returns true if granted (or already granted), false if denied.
   * Safe to call on simulators — returns false without prompting.
   */
  requestPermission(): Promise<boolean>;

  /**
   * Returns the device's native FCM/APNs push token.
   * Returns null on simulators, or when permission is not granted.
   */
  getDeviceToken(): Promise<string | null>;

  /**
   * Persists the FCM token to the user's Firestore profile so that
   * Cloud Functions can send push notifications to this device.
   */
  saveDeviceToken(userId: string, token: string): Promise<void>;

  /**
   * Subscribes to FCM token rotation events that fire mid-session.
   * The OS can silently invalidate and replace a push token at any time.
   * Returns an unsubscribe function — MUST be called on cleanup to avoid leaks.
   */
  onTokenRefresh(handler: (newToken: string) => void): () => void;
}
