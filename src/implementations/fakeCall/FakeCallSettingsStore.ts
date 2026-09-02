import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FakeCallSettings } from '../../models/FakeCall';
import { defaultFakeCallSettings } from '../../models/FakeCall';

const STORAGE_KEY = 'homesafe.fakecall.settings';

export const FakeCallSettingsStore = {
  async load(): Promise<FakeCallSettings> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultFakeCallSettings();
      return JSON.parse(raw) as FakeCallSettings;
    } catch {
      return defaultFakeCallSettings();
    }
  },

  async save(settings: FakeCallSettings): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  },
};
