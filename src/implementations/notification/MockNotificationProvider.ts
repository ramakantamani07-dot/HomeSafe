import type { NotificationProvider } from '../../providers/NotificationProvider';

const MOCK_FCM_TOKEN = 'mock-fcm-token-dev-only';

export class MockNotificationProvider implements NotificationProvider {
  private readonly store = new Map<string, string>(); // userId → token

  async requestPermission(): Promise<boolean> {
    return true;
  }

  async getDeviceToken(): Promise<string | null> {
    return MOCK_FCM_TOKEN;
  }

  async saveDeviceToken(userId: string, token: string): Promise<void> {
    this.store.set(userId, token);
  }

  onTokenRefresh(_handler: (newToken: string) => void): () => void {
    return () => {};
  }
}
