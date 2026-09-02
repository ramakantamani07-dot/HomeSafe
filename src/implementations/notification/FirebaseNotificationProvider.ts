import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  getFirestore,
  doc,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';

import type { NotificationProvider } from '../../providers/NotificationProvider';

export class FirebaseNotificationProvider implements NotificationProvider {
  private readonly db: Firestore;

  constructor(app: FirebaseApp) {
    this.db = getFirestore(app);
  }

  async requestPermission(): Promise<boolean> {
    // Android requires a notification channel before permissions are meaningful.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'HomeSafe Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E53E3E',
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    if (existing === 'denied') return false;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }

  async getDeviceToken(): Promise<string | null> {
    try {
      // getDevicePushTokenAsync returns the native FCM token (Android) or
      // APNs token (iOS). It throws on simulators — handled by the catch.
      const result = await Notifications.getDevicePushTokenAsync();
      return result.data ?? null;
    } catch {
      // Simulator, permission not granted, or missing google-services.json
      return null;
    }
  }

  async saveDeviceToken(userId: string, token: string): Promise<void> {
    // setDoc with merge:true creates the document if absent. This is the
    // authoritative write that Cloud Functions read to send FCM messages.
    const ref = doc(this.db, 'users', userId);
    await setDoc(ref, { fcmToken: token }, { merge: true });
  }

  onTokenRefresh(handler: (newToken: string) => void): () => void {
    // The OS can silently rotate the FCM token mid-session (e.g. after a
    // factory reset restore or token invalidation). Subscribe here so the
    // new token is persisted without requiring a sign-out/sign-in cycle.
    const subscription = Notifications.addPushTokenListener((deviceToken) => {
      handler(deviceToken.data);
    });
    return () => subscription.remove();
  }
}
