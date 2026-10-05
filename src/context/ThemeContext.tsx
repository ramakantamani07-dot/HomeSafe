import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { darkTheme, lightTheme, type ThemeColors } from '../config/theme';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_MODE_STORAGE_KEY = '@wayloc/theme_mode';

const ThemeContext = createContext<ThemeColors>(lightTheme);

interface ThemeModeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

// Defaults 'system' before the persisted value loads, matching the previous
// (pure useColorScheme) behavior, so there's no flash of the wrong theme.
const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: 'system',
  setMode: () => {},
});

export function ThemeStateProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_MODE_STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setModeState(stored);
      }
    });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, next).catch(() => {});
  }, []);

  const effectiveScheme = mode === 'system' ? systemScheme : mode;
  const colors = effectiveScheme === 'dark' ? darkTheme : lightTheme;

  // `colors` is one of two module-level constants, so it is already stable;
  // only the mode pair needs memoising.
  const modeValue = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return (
    <ThemeModeContext.Provider value={modeValue}>
      <ThemeContext.Provider value={colors}>{children}</ThemeContext.Provider>
    </ThemeModeContext.Provider>
  );
}

export function useTheme(): ThemeColors {
  return useContext(ThemeContext);
}

// Separate from useTheme() so the ~30 screens that only need colors don't
// have to change — only the Settings screen's appearance picker needs this.
export function useThemeMode(): ThemeModeContextValue {
  return useContext(ThemeModeContext);
}
