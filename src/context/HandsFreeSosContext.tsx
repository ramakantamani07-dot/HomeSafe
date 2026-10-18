import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { HandsFreeSosService } from '../services/HandsFreeSosService';
import { useAuthContext } from './AuthContext';
import { useLocationTrackingContext } from './LocationTrackingContext';

interface HandsFreeSosContextValue {
  /** Whether this phone can do hands-free SOS at all (iPhone with the native module). */
  available: boolean;
  enabled: boolean;
  busy: boolean;
  enable(): Promise<void>;
  disable(): Promise<void>;
  /** Siri triggers alert nobody for ten minutes. */
  startTest(): boolean;
  endTest(): boolean;
}

const HandsFreeSosContext = createContext<HandsFreeSosContextValue>({
  available: false,
  enabled: false,
  busy: false,
  enable: async () => {},
  disable: async () => {},
  startTest: () => false,
  endTest: () => false,
});

/**
 * Hands-free SOS for this phone. Also does the two things that must not
 * depend on a screen remembering to: wipes the key from the phone when the
 * account signs out by any route, and keeps the last known position fresh for
 * Siri while a journey is tracked.
 */
export function HandsFreeSosStateProvider({
  service,
  children,
}: {
  service: HandsFreeSosService;
  children: React.ReactNode;
}) {
  const { user } = useAuthContext();
  const { currentLocation, lastLocationUpdateAt } = useLocationTrackingContext();
  const [enabled, setEnabled] = useState(() => service.isEnabled());
  const [busy, setBusy] = useState(false);

  // Null while auth loads on a cold start, so only a user → none change is a sign-out.
  const signedInAs = useRef<string | null>(null);
  useEffect(() => {
    if (user?.id) {
      signedInAs.current = user.id;
      return;
    }
    if (signedInAs.current) {
      service.forgetLocally();
      setEnabled(false);
    }
    signedInAs.current = null;
  }, [user?.id, service]);

  useEffect(() => {
    if (!enabled || !currentLocation) return;
    service.recordLocation(
      currentLocation.latitude,
      currentLocation.longitude,
      lastLocationUpdateAt ?? new Date(),
    );
  }, [enabled, currentLocation, lastLocationUpdateAt, service]);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      await service.enable();
      setEnabled(service.isEnabled());
    } finally {
      setBusy(false);
    }
  }, [service]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      await service.disable();
      setEnabled(false);
    } finally {
      setBusy(false);
    }
  }, [service]);

  const startTest = useCallback(() => service.startTest(), [service]);
  const endTest = useCallback(() => service.endTest(), [service]);

  const value = useMemo<HandsFreeSosContextValue>(
    () => ({ available: service.available, enabled, busy, enable, disable, startTest, endTest }),
    [service, enabled, busy, enable, disable, startTest, endTest],
  );

  return <HandsFreeSosContext.Provider value={value}>{children}</HandsFreeSosContext.Provider>;
}

export function useHandsFreeSosContext(): HandsFreeSosContextValue {
  return useContext(HandsFreeSosContext);
}
