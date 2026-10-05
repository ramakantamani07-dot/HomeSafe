import type { StorageProvider } from '../../providers/StorageProvider';
import { getItem, setItem, removeItem } from './secureStorage';
import type { User, UserSettings } from '../../models/User';

type StoredUser = Omit<User, 'createdAt'> & {
  createdAt: string;
};

const userKey = (userId: string) => `wayloc.user.${userId}`;
const preferencesKey = (userId: string) => `wayloc.user-preferences.${userId}`;

function serializeUser(user: User): StoredUser {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
  };
}

function deserializeUser(user: StoredUser): User {
  return {
    ...user,
    createdAt: new Date(user.createdAt),
  };
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await setItem(key, JSON.stringify(value));
}

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await getItem(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export class SecureUserStorageProvider implements StorageProvider {
  async getUser(userId: string): Promise<User | null> {
    const stored = await readJson<StoredUser>(userKey(userId));
    return stored ? deserializeUser(stored) : null;
  }

  async saveUser(user: User): Promise<void> {
    await writeJson(userKey(user.id), serializeUser(user));
    await this.saveUserPreferences(user.id, user.settings);
  }

  async updateUser(userId: string, updates: Partial<Omit<User, 'id'>>): Promise<void> {
    const existing = await this.getUser(userId);
    if (!existing) {
      return;
    }

    const nextUser: User = {
      ...existing,
      ...updates,
      id: userId,
      createdAt: updates.createdAt ?? existing.createdAt,
      settings: {
        ...existing.settings,
        ...updates.settings,
      },
    };

    await this.saveUser(nextUser);
  }

  async getUserPreferences(userId: string): Promise<UserSettings | null> {
    return readJson<UserSettings>(preferencesKey(userId));
  }

  async saveUserPreferences(userId: string, settings: UserSettings): Promise<void> {
    await writeJson(preferencesKey(userId), settings);
  }

  async deleteUser(userId: string): Promise<void> {
    await removeItem(userKey(userId));
    await removeItem(preferencesKey(userId));
  }
}
