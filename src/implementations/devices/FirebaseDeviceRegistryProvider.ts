import { Platform } from 'react-native';
import { doc, getFirestore, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';

import type { DeviceRegistryProvider } from '../../providers/DeviceRegistryProvider';
import { installationId } from './installationId';

export class FirebaseDeviceRegistryProvider implements DeviceRegistryProvider {
  private readonly db: Firestore;

  constructor(app: FirebaseApp) {
    this.db = getFirestore(app);
  }

  async register(userId: string, pushToken: string | null): Promise<void> {
    const ref = doc(this.db, 'users', userId, 'devices', await installationId());
    // A merge write, because the rules let the app neither read nor delete
    // these records: it is a create the first time, an update after.
    await setDoc(
      ref,
      { platform: Platform.OS, pushToken, lastSeenAt: serverTimestamp() },
      { merge: true },
    );
  }
}
