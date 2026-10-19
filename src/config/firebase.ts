import Constants from 'expo-constants';
import { initializeApp, getApps, FirebaseApp } from '@firebase/app';
import { getFunctions, type Functions } from 'firebase/functions';

const {
  firebaseApiKey,
  firebaseAuthDomain,
  firebaseProjectId,
  firebaseStorageBucket,
  firebaseMessagingSenderId,
  firebaseAppId,
  firebaseFunctionsRegion,
} = Constants.expoConfig?.extra ?? {};

/**
 * Where Cloud Functions run: Mumbai, beside the database (India launch). Must
 * match functions/src/shared/region.ts. Without it the SDK calls us-central1,
 * where nothing is deployed.
 */
export const FUNCTIONS_REGION: string = (firebaseFunctionsRegion as string | undefined) ?? 'asia-south1';

/** The app's Cloud Functions, in their region. Use this, never `getFunctions(app)`. */
export function getAppFunctions(app: FirebaseApp): Functions {
  return getFunctions(app, FUNCTIONS_REGION);
}

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
