import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { SafetyPreferences } from '../models/SafetyPreferences';
import { DEFAULT_SAFETY_PREFERENCES } from '../models/SafetyPreferences';
import { SafetyPreferencesStore } from '../implementations/security/SafetyPreferencesStore';

interface SafetyPreferencesContextValue {
  preferences: SafetyPreferences;
  setPreferences(next: SafetyPreferences): Promise<void>;
}

const SafetyPreferencesContext = createContext<SafetyPreferencesContextValue>({
  preferences: DEFAULT_SAFETY_PREFERENCES,
  setPreferences: async () => {},
});

/**
 * Safety-tool settings (`AI11`), shared by Settings and by the SOS control.
 *
 * A context rather than each screen loading the store: the SOS hold bar needs
 * the hold time on *every* screen it appears on, and an async read per mount
 * would mean the control briefly disagreeing with the user's setting. Starting
 * from the defaults and replacing them once loaded keeps SOS usable throughout —
 * the fallback is the standard 3-second hold, never an unreachable one.
 */
export function SafetyPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setLocal] = useState<SafetyPreferences>(DEFAULT_SAFETY_PREFERENCES);

  useEffect(() => {
    let cancelled = false;
    void SafetyPreferencesStore.load().then((loaded) => {
      if (!cancelled) setLocal(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreferences = useCallback(async (next: SafetyPreferences) => {
    // Applied immediately, then persisted: a setting that visibly lags the tap
    // reads as broken, and a failed write is recoverable where a confusing
    // control is not.
    setLocal(next);
    await SafetyPreferencesStore.save(next);
  }, []);

  const value = useMemo(() => ({ preferences, setPreferences }), [preferences, setPreferences]);

  return (
    <SafetyPreferencesContext.Provider value={value}>{children}</SafetyPreferencesContext.Provider>
  );
}

export function useSafetyPreferences(): SafetyPreferencesContextValue {
  return useContext(SafetyPreferencesContext);
}
