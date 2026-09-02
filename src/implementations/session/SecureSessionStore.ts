import { SECURE_STORE_KEYS } from '../../config/constants';
import { getItem, setItem, removeItem } from '../storage/secureStorage';
import type { User } from '../../models/User';

type StoredSessionUser = Omit<User, 'createdAt'> & {
  createdAt: string;
};

type StoredSession = {
  user: StoredSessionUser;
  savedAt: string;
};

function serializeUser(user: User): StoredSessionUser {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
  };
}

function deserializeUser(user: StoredSessionUser): User {
  return {
    ...user,
    createdAt: new Date(user.createdAt),
  };
}

export async function saveSecureSession(user: User): Promise<void> {
  const session: StoredSession = {
    user: serializeUser(user),
    savedAt: new Date().toISOString(),
  };

  await setItem(SECURE_STORE_KEYS.session, JSON.stringify(session));
}

export async function getSecureSessionUser(): Promise<User | null> {
  const raw = await getItem(SECURE_STORE_KEYS.session);
  if (!raw) {
    return null;
  }

  const session = JSON.parse(raw) as StoredSession;
  return deserializeUser(session.user);
}

export async function clearSecureSession(): Promise<void> {
  await removeItem(SECURE_STORE_KEYS.session);
}
