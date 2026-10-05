import Constants from 'expo-constants';
import { initializeApp, getApps, FirebaseApp } from '@firebase/app';

const {
  firebaseApiKey,
  firebaseAuthDomain,
  firebaseProjectId,
  firebaseStorageBucket,
  firebaseMessagingSenderId,
  firebaseAppId,
} = Constants.expoConfig?.extra ?? {};

const firebaseConfig = {
  apiKey: firebaseApiKey as string,
  authDomain: firebaseAuthDomain as string,
  projectId: firebaseProjectId as string,
  storageBucket: firebaseStorageBucket as string,
  messagingSenderId: firebaseMessagingSenderId as string,
  appId: firebaseAppId as string,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseApiKey && firebaseAuthDomain && firebaseProjectId && firebaseAppId);
}

// Only initialise Firebase when real credentials are present.
// MockAuthProvider is used when this returns null.
function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (getApps().length > 0) return getApps()[0];
  return initializeApp(firebaseConfig);
}

export const firebaseApp = getFirebaseApp();
export { firebaseConfig };
