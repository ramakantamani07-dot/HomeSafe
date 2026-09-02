import type { User, UserSettings } from '../models/User';

export interface StorageProvider {
  getUser(userId: string): Promise<User | null>;
  saveUser(user: User): Promise<void>;
  updateUser(userId: string, updates: Partial<Omit<User, 'id'>>): Promise<void>;
  getUserPreferences?(userId: string): Promise<UserSettings | null>;
  saveUserPreferences?(userId: string, settings: UserSettings): Promise<void>;
  /** Removes the locally stored user profile and preferences for the given id. */
  deleteUser?(userId: string): Promise<void>;
}
