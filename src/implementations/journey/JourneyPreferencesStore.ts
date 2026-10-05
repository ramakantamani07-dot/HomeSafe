import AsyncStorage from '@react-native-async-storage/async-storage';

import type { JourneyPreferences } from '../../models/JourneyPreferences';
import {
  DEFAULT_JOURNEY_PREFERENCES,
  isValidCheckInInterval,
} from '../../models/JourneyPreferences';

const STORAGE_KEY = 'wayloc.journey.preferences';

/**
 * Device-local persistence for journey defaults, following the same shape as
 * FakeCallSettingsStore.
 *
 * Local rather than Firestore because these are device preferences, not
 * account data: they must work before sign-in completes and offline, and a
 * failed read falls back to the defaults rather than leaving the user with no
 * check-ins at all.
 */
export const JourneyPreferencesStore = {
  async load(): Promise<JourneyPreferences> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_JOURNEY_PREFERENCES;
      const parsed = JSON.parse(raw) as Partial<JourneyPreferences>;
      const interval = parsed.checkInIntervalMinutes ?? null;
      // A value written by an older build may no longer be offered. Falling
      // back to the default is safer than persisting an interval the UI can't
      // represent — the user would see "Off" while check-ins still fired.
      return isValidCheckInInterval(interval)
        ? { checkInIntervalMinutes: interval }
        : DEFAULT_JOURNEY_PREFERENCES;
    } catch {
      return DEFAULT_JOURNEY_PREFERENCES;
    }
  },

  async save(preferences: JourneyPreferences): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  },
};
