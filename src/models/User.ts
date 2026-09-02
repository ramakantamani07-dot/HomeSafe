export interface UserSettings {
  rememberSession: boolean;
}

export interface User {
  id: string;
  phone: string;
  name: string;
  photoURL: string | null;
  fcmToken: string;
  settings: UserSettings;
  createdAt: Date;
}

export function defaultUserSettings(): UserSettings {
  return {
    rememberSession: true,
  };
}

export function isProfileComplete(user: User): boolean {
  return user.name.trim().length > 0;
}
