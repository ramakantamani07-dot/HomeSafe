import type { AuthProvider } from '../providers/AuthProvider';
import type { StorageProvider } from '../providers/StorageProvider';
import type { User } from '../models/User';
import type { Unsubscribe } from '../providers/types';

/**
 * Orchestrates auth + user-profile persistence.
 * Screens must not call AuthProvider or StorageProvider directly —
 * go through AuthService via the useAuth hook.
 */
export class AuthService {
  constructor(
    private readonly auth: AuthProvider,
    private readonly storage: StorageProvider
  ) {}

  async sendOTP(phone: string): Promise<void> {
    return this.auth.sendOTP(phone);
  }

  async verifyOTP(code: string): Promise<User> {
    const user = await this.auth.verifyOTP(code);

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
