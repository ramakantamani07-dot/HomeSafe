import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { OfflineSyncService } from '../services/OfflineSyncService';
import { useNetwork } from './NetworkContext';

interface OfflineSyncContextValue {
  /** Number of operations waiting to be synced. */
  pendingCount: number;
  /** Number of operations that have permanently failed (retryCount >= MAX_RETRIES). */
  failedCount: number;
  /** True while a sync pass is in progress. */
  isSyncing: boolean;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue>({
  pendingCount: 0,
  failedCount: 0,
  isSyncing: false,
});

export function OfflineSyncStateProvider({
  offlineSyncService,
  children,
}: {
  offlineSyncService: OfflineSyncService;
  children: React.ReactNode;
}) {
  const { isInternetReachable } = useNetwork();
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Tracks the previous reachability so the second effect only fires on the
  // offline→online edge, not on every render or same-value update.
  const prevReachable = useRef(isInternetReachable);

  // On mount: load counts and, if already connected, flush any items left over
  // from a previous offline session.
  // Guard: only attempt sync when connected — calling syncNow() while offline
  // would increment retryCount on every item without ever succeeding.
  useEffect(() => {
    let active = true;

    async function init() {
      if (isInternetReachable) {
        if (active) setIsSyncing(true);
        try {
          await offlineSyncService.syncNow();
        } catch {
          // Per-item errors are handled inside syncNow; swallow here.
        }
        if (!active) return;
        setIsSyncing(false);
      }

      if (!active) return;
      const [p, f] = await Promise.all([
        offlineSyncService.getPendingCount(),
        offlineSyncService.getFailedCount(),
      ]);
      if (active) {
        setPendingCount(p);
        setFailedCount(f);
      }
    }

    void init();
    return () => { active = false; };
    // Intentionally excludes isInternetReachable: we only check connectivity
    // once at startup. Ongoing connectivity changes are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlineSyncService]);

  // Sync whenever the device transitions from offline → online.
  useEffect(() => {
    const wasOffline = !prevReachable.current;
    prevReachable.current = isInternetReachable;

    // Only act on the offline → online edge.
    if (!isInternetReachable || !wasOffline) return;

    let active = true;

    async function doSync() {
      if (active) setIsSyncing(true);
      try {
        await offlineSyncService.syncNow();
      } catch {
        // Per-item errors are handled inside syncNow; swallow here.
      }
      if (!active) return;
      setIsSyncing(false);
      const [p, f] = await Promise.all([
        offlineSyncService.getPendingCount(),
        offlineSyncService.getFailedCount(),
      ]);
      if (active) {
        setPendingCount(p);
        setFailedCount(f);
      }
    }

    void doSync();
    return () => { active = false; };
  }, [isInternetReachable, offlineSyncService]);

  return (
    <OfflineSyncContext.Provider value={{ pendingCount, failedCount, isSyncing }}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSyncContext(): OfflineSyncContextValue {
  return useContext(OfflineSyncContext);
}
