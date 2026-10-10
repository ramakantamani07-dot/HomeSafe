import {
  getAuth,
  initializeAuth,
  PhoneAuthProvider,
  Persistence,
  signInWithCredential,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signOut as firebaseSignOut,
  deleteUser as firebaseDeleteUser,
  Auth,
  // Imported from '@firebase/auth' (the scoped package), not the 'firebase/auth'
  // wrapper — see metro.config.js's unstable_enablePackageExports comment for
  // why. getReactNativePersistence itself stays a lazy require() below (not a
  // static import here) since it doesn't exist in the browser build this same
  // file also gets bundled as on web.
} from '@firebase/auth';
import type { FirebaseApp } from 'firebase/app';
import type { ApplicationVerifier } from '@firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { AuthProvider } from '../../providers/AuthProvider';
import type { Unsubscribe } from '../../providers/types';
import type { User } from '../../models/User';
import { defaultUserSettings } from '../../models/User';
import { WrongCodeError } from '../../models/SignIn';

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

function mapFirebaseErrorCode(code: string): string {
  const map: Record<string, string> = {
    'auth/invalid-phone-number': 'The phone number you entered is invalid.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/invalid-verification-code': 'The code you entered is incorrect.',
    'auth/code-expired': 'The OTP has expired. Please request a new one.',
    'auth/network-request-failed': 'No internet connection. Please check your network.',
    'auth/session-expired': 'Your session has expired. Please start again.',
    'auth/requires-recent-login':
      'For security, please sign out and sign in again before deleting your account.',
  };
  return map[code] ?? 'An unexpected error occurred. Please try again.';
}

function mapFirebaseUser(firebaseUser: { uid: string; phoneNumber: string | null }): User {
  return {
    id: firebaseUser.uid,
    phone: firebaseUser.phoneNumber ?? '',
    name: '',
    photoURL: null,
    fcmToken: '',
    settings: defaultUserSettings(),
    createdAt: new Date(),
  };
}

type ReactNativePersistenceStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

type ReactNativePersistenceFactory = (storage: ReactNativePersistenceStorage) => Persistence;

// Firebase Auth's persistence keys are colon-delimited
// (firebase:authUser:<apiKey>:<appName> — verified directly in
// @firebase/auth's source, _persistenceKeyName). expo-secure-store rejects
// keys containing ':' outright, so SecureStore cannot back this — AsyncStorage
// has no such restriction and is Firebase's own documented choice for React
// Native.
const asyncStoragePersistence: ReactNativePersistenceStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

const getNativePersistence = (): Persistence => {
  const authModule = require('@firebase/auth') as {
    getReactNativePersistence?: ReactNativePersistenceFactory;
  };

  if (!authModule.getReactNativePersistence) {
    throw new Error('React Native Firebase auth persistence is not available.');
  }

  return authModule.getReactNativePersistence(asyncStoragePersistence);
};

export class FirebaseAuthProvider implements AuthProvider {
  private readonly auth: Auth;
  private verificationId: string | null = null;
  private appVerifier: ApplicationVerifier | null = null;

  constructor(app: FirebaseApp) {
    if (Platform.OS === 'web') {
      this.auth = getAuth(app);
      return;
    }

    try {
      this.auth = initializeAuth(app, {
        persistence: getNativePersistence(),
      });
    } catch {
      this.auth = getAuth(app);
    }
  }

  /**
   * Called by the UI layer (phone screen) before sendOTP.
   *
   * No verifier exists today — see FirebaseRecaptchaVerifier for why the
   * WebView shim was removed and what replaces it. The seam is kept so
   * swapping in @react-native-firebase/auth touches neither this port nor the
   * auth screens.
   */
  setAppVerifier(verifier: ApplicationVerifier): void {
    this.appVerifier = verifier;
  }

  async sendOTP(phone: string): Promise<void> {
    if (!this.appVerifier) {
      // Deliberately explicit rather than a generic failure: this is the one
      // thing standing between the app and real phone auth, and a vague
      // message here would send someone hunting through the auth screens
      // instead of at the actual gap.
      throw new AuthError(
        'Phone sign-in is not wired up yet. The Firebase JS SDK needs a ' +
          'reCAPTCHA verifier that React Native cannot provide; install ' +
          '@react-native-firebase/auth and use its native phone verification ' +
          'instead. See src/components/auth/FirebaseRecaptchaVerifier.tsx.',
        'auth/missing-verifier',
      );
    }
    try {
      const provider = new PhoneAuthProvider(this.auth);
      this.verificationId = await provider.verifyPhoneNumber(phone, this.appVerifier);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? 'auth/unknown';
      throw new AuthError(mapFirebaseErrorCode(code), code, err);
    }
  }

  async verifyOTP(code: string): Promise<User> {
    if (!this.verificationId) {
      throw new AuthError(
        'No active OTP session. Call sendOTP first.',
        'auth/no-session'
      );
    }
    try {
      const credential = PhoneAuthProvider.credential(this.verificationId, code);
      const result = await signInWithCredential(this.auth, credential);
      this.verificationId = null;
      return mapFirebaseUser(result.user);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? 'auth/unknown';
      if (code === 'auth/invalid-verification-code') throw new WrongCodeError();
      throw new AuthError(mapFirebaseErrorCode(code), code, err);
    }
  }

  async getCurrentUser(): Promise<User | null> {
    const firebaseUser = this.auth.currentUser;
    return firebaseUser ? mapFirebaseUser(firebaseUser) : null;
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(this.auth);
    this.verificationId = null;
    this.appVerifier = null;
  }

  onAuthStateChanged(callback: (user: User | null) => void): Unsubscribe {
    return firebaseOnAuthStateChanged(this.auth, (firebaseUser) => {
      callback(firebaseUser ? mapFirebaseUser(firebaseUser) : null);
    });
  }

  async deleteAuthAccount(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new AuthError('No signed-in user to delete.', 'auth/no-current-user');
    }
    try {
      await firebaseDeleteUser(user);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? 'auth/unknown';
      throw new AuthError(mapFirebaseErrorCode(code), code, err);
    }
  }

  getAuth(): Auth {
    return this.auth;
  }
}
