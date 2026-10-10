import type { User } from '../models/User';
import type { Unsubscribe } from './types';

export interface AuthProvider {
  /**
   * Sends an OTP to the given phone number.
   * Implementations store the resulting session internally.
   */
  sendOTP(phone: string): Promise<void>;

  /**
   * Verifies the OTP code against the session created by sendOTP.
   * Returns the authenticated User on success.
   *
   * A code that is simply wrong must reject with `WrongCodeError`
   * (models/SignIn) — and only that case, since `AuthService` counts those
   * towards the lock. Network and session failures reject with anything else.
   */
  verifyOTP(code: string): Promise<User>;

  /** Returns the currently signed-in user, or null. */
  getCurrentUser(): Promise<User | null>;

  /** Signs out the current user and clears the local session. */
  signOut(): Promise<void>;

  /** Subscribes to auth state changes. Returns an unsubscribe function. */
  onAuthStateChanged(callback: (user: User | null) => void): Unsubscribe;

  /**
   * Permanently deletes the Firebase Authentication account for the currently
   * signed-in user. Must be called AFTER all Firestore data has been deleted
   * (auth token is required for Firestore writes up to this point).
   *
   * Throws an error with code 'auth/requires-recent-login' if the session is
   * too old — the user must sign in again before retrying.
   */
  deleteAuthAccount(): Promise<void>;
}
