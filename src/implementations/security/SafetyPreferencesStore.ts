import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SafetyPreferences } from '../../models/SafetyPreferences';
import {
  DEFAULT_SAFETY_PREFERENCES,
  sanitiseSafetyPreferences,
} from '../../models/SafetyPreferences';

const STORAGE_KEY = 'wayloc.safety.preferences';

/**
 * Device-local persistence for safety-tool settings, following the same shape
 * as JourneyPreferencesStore.
 *
 * Local rather than Firestore for the same reason: these must work before
 * sign-in completes and while offline. A failed read falls back to defaults —
 * which for SOS means the standard 3-second hold, never an unreachable one.
 */
export const SafetyPreferencesStore = {
  async load(): Promise<SafetyPreferences> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_SAFETY_PREFERENCES;
      return sanitiseSafetyPreferences(JSON.parse(raw) as Partial<SafetyPreferences>);
    } catch {
      return DEFAULT_SAFETY_PREFERENCES;
    }
  },

  async save(preferences: SafetyPreferences): Promise<void> {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(sanitiseSafetyPreferences(preferences)),
    );
  },
};
