import { useOfflineSyncContext } from '../context/OfflineSyncContext';

export function useOfflineSync() {
  return useOfflineSyncContext();
}
