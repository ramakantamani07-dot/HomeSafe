import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import type { NotificationService } from '../services/NotificationService';
import { useAuthContext } from './AuthContext';

interface NotificationContextValue {
  /** FCM device token registered for this device, or null if unavailable. */
  deviceToken: string | null;
  /** True while the registration flow is in progress on sign-in. */
  isRegistering: boolean;
}

export const NotificationContext = createContext<NotificationContextValue>({
  deviceToken: null,
  isRegistering: false,
});

export function NotificationStateProvider({
  notificationService,
  children,
}: {
  notificationService: NotificationService;
  children: React.ReactNode;
}) {
  const { user } = useAuthContext();
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Re-register on every sign-in. Tokens can rotate between sessions, so we
  // always fetch and persist the latest token rather than caching the old one.
  useEffect(() => {
    if (!user?.id) {
      setDeviceToken(null);
      return;
    }

    let mounted = true;
    const userId = user.id;
    setIsRegistering(true);

    notificationService
      .registerDevice(userId)
      .then((token) => { if (mounted) setDeviceToken(token); })
      .catch(() => { /* permission denied or device unavailable — non-fatal */ })
      .finally(() => { if (mounted) setIsRegistering(false); });

    // FCM can silently rotate the token mid-session. Subscribe so the new
    // token is persisted to Firestore without requiring a sign-out/sign-in.
    const unsubscribeRefresh = notificationService.watchTokenRefresh(userId, (newToken) => {
      if (mounted) setDeviceToken(newToken);
    });

    return () => {
      mounted = false;
      unsubscribeRefresh();
    };
  }, [user?.id, notificationService]);

  const value = useMemo(() => ({ deviceToken, isRegistering }), [deviceToken, isRegistering]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext(): NotificationContextValue {
  return useContext(NotificationContext);
}
