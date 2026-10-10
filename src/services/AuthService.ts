import type { AuthProvider } from '../providers/AuthProvider';
import type { StorageProvider } from '../providers/StorageProvider';
import type { User } from '../models/User';
import type { Unsubscribe } from '../providers/types';
import {
  NO_ATTEMPTS,
  SignInLockedError,
  WrongCodeError,
  recordWrongCode,
  settle,
  triesLeft,
  type CodeAttempts,
} from '../models/SignIn';

/**
 * Orchestrates auth + user-profile persistence.
 * Screens must not call AuthProvider or StorageProvider directly —
 * go through AuthService via the useAuth hook.
 */
export class AuthService {
  /**
   * Wrong codes per phone number, so changing number does not reset the
   * count and a lock on one number does not block another. In memory: a
   * restart forgets it, and the provider's own server-side limit still holds.
   */
  private readonly attempts = new Map<string, CodeAttempts>();
  private pendingPhone: string | null = null;

  constructor(
    private readonly auth: AuthProvider,
    private readonly storage: StorageProvider,
    private readonly now: () => number = Date.now,
  ) {}

  async sendOTP(phone: string): Promise<void> {
    // A code that could not be entered would be a wasted text.
    this.throwIfLocked(phone);
    await this.auth.sendOTP(phone);
    this.pendingPhone = phone;
  }

  async verifyOTP(code: string): Promise<User> {
    const phone = this.pendingPhone;
    if (phone) this.throwIfLocked(phone);

    let user: User;
    try {
      user = await this.auth.verifyOTP(code);
    } catch (err) {
      if (err instanceof WrongCodeError && phone) {
        const next = recordWrongCode(this.attemptsFor(phone), this.now());
        this.attempts.set(phone, next);
        if (next.lockedUntil !== null) throw new SignInLockedError(new Date(next.lockedUntil));
        err.triesLeft = triesLeft(next);
      }
      throw err;
    }
    if (phone) this.attempts.delete(phone);
    this.pendingPhone = null;

    // Check if a profile already exists in storage; create one on first login.
    const existing = await this.storage.getUser(user.id);
    if (!existing) {
      await this.storage.saveUser({ ...user, createdAt: new Date() });
      return user;
    }
    // Return the stored profile (has name, fcmToken, settings) merged with
    // the live auth record (phone, id).
    return { ...existing, id: user.id, phone: user.phone };
  }

  private attemptsFor(phone: string): CodeAttempts {
    return settle(this.attempts.get(phone) ?? NO_ATTEMPTS, this.now());
  }

  private throwIfLocked(phone: string): void {
    const { lockedUntil } = this.attemptsFor(phone);
    if (lockedUntil !== null) throw new SignInLockedError(new Date(lockedUntil));
  }

  async getCurrentUser(): Promise<User | null> {
    const authUser = await this.auth.getCurrentUser();
    if (!authUser) return null;

    const stored = await this.storage.getUser(authUser.id);
    return stored ? { ...stored, id: authUser.id, phone: authUser.phone } : authUser;
  }

  async updateUserProfile(
    userId: string,
    updates: Partial<Omit<User, 'id'>>,
  ): Promise<User> {
    const existing = await this.storage.getUser(userId);
    if (!existing) {
      throw new Error('User profile was not found.');
    }

    await this.storage.updateUser(userId, updates);
    const updated = await this.storage.getUser(userId);
    return updated ?? {
      ...existing,
      ...updates,
      id: userId,
      createdAt: updates.createdAt ?? existing.createdAt,
      settings: {
        ...existing.settings,
        ...updates.settings,
      },
    };
  }

  async signOut(): Promise<void> {
    return this.auth.signOut();
  }

  onAuthStateChanged(callback: (user: User | null) => void): Unsubscribe {
    return this.auth.onAuthStateChanged(callback);
  }
}
