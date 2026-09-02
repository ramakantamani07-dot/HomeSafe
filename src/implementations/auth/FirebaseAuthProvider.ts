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
} from 'firebase/auth';
import type { FirebaseApp } from 'firebase/app';
import type { ApplicationVerifier } from 'firebase/auth';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { AuthProvider } from '../../providers/AuthProvider';
import type { Unsubscribe } from '../../providers/types';
import type { User } from '../../models/User';
import { defaultUserSettings } from '../../models/User';

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

const secureStorePersistence: ReactNativePersistenceStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

const getNativePersistence = (): Persistence => {
  const authModule = require('@firebase/auth') as {
    getReactNativePersistence?: ReactNativePersistenceFactory;
  };

  if (!authModule.getReactNativePersistence) {
    throw new Error('React Native Firebase auth persistence is not available.');
  }

  return authModule.getReactNativePersistence(secureStorePersistence);
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
   * expo-firebase-recaptcha's FirebaseRecaptchaVerifierModal satisfies
   * the ApplicationVerifier interface.
   */
  setAppVerifier(verifier: ApplicationVerifier): void {
    this.appVerifier = verifier;
  }

  async sendOTP(phone: string): Promise<void> {
    if (!this.appVerifier) {
      throw new AuthError(
        'Recaptcha verifier not configured. Call setAppVerifier first.',
        'auth/missing-verifier'
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
