/**
 * Development-only auth provider. Used automatically when Firebase credentials
 * are not configured. Any phone number and any 6-digit code are accepted.
 * Never ship this in a production build.
 */
import type { AuthProvider } from '../../providers/AuthProvider';
import type { Unsubscribe } from '../../providers/types';
import type { User } from '../../models/User';
import { defaultUserSettings } from '../../models/User';

const MOCK_USER: User = {
  id: 'dev-user-001',
  phone: '+910000000000',
  name: 'Dev User',
  photoURL: null,
  fcmToken: '',
  settings: defaultUserSettings(),
  createdAt: new Date(),
};

export class MockAuthProvider implements AuthProvider {
  private currentUser: User | null = null;
  private listeners: Array<(user: User | null) => void> = [];
  private pendingPhone: string = MOCK_USER.phone;

  private notify(user: User | null) {
    this.listeners.forEach((cb) => cb(user));
  }

  async sendOTP(phone: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 800));
    this.pendingPhone = phone;
  }

  async verifyOTP(code: string): Promise<User> {
    await new Promise((r) => setTimeout(r, 600));
    if (code.length !== 6) {
      throw new Error('Enter a 6-digit code.');
    }
    this.currentUser = { ...MOCK_USER, phone: this.pendingPhone };
    this.notify(this.currentUser);
    return this.currentUser;
  }

  async getCurrentUser(): Promise<User | null> {
    return this.currentUser;
  }

  async signOut(): Promise<void> {
    this.currentUser = null;
    this.notify(null);
  }

  onAuthStateChanged(callback: (user: User | null) => void): Unsubscribe {
    this.listeners.push(callback);
    // Emit current state immediately
    setTimeout(() => callback(this.currentUser), 0);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  async deleteAuthAccount(): Promise<void> {
    this.currentUser = null;
    this.notify(null);
  }
}
