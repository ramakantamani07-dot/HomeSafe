import { SECURE_STORE_KEYS } from '../../config/constants';
import { getItem, setItem } from './secureStorage';
import {
  DEFAULT_PRIVACY_PREFERENCES,
  type PrivacyPreferences,
} from '../../models/Permission';

export async function loadPrivacyPreferences(): Promise<PrivacyPreferences> {
  const raw = await getItem(SECURE_STORE_KEYS.privacyPreferences);
  if (!raw) return { ...DEFAULT_PRIVACY_PREFERENCES };
  try {
    return { ...DEFAULT_PRIVACY_PREFERENCES, ...(JSON.parse(raw) as Partial<PrivacyPreferences>) };
  } catch {
    return { ...DEFAULT_PRIVACY_PREFERENCES };
  }
}

export async function savePrivacyPreferences(prefs: PrivacyPreferences): Promise<void> {
  await setItem(SECURE_STORE_KEYS.privacyPreferences, JSON.stringify(prefs));
}
