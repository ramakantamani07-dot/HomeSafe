import { useNetwork } from '../context/NetworkContext';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean;
  /** Convenience: true when there is no usable internet connection. */
  isOffline: boolean;
}

/** Returns current network connectivity state with an `isOffline` convenience flag. */
export function useNetworkStatus(): NetworkStatus {
  const { isConnected, isInternetReachable } = useNetwork();
  return {
    isConnected,
    isInternetReachable,
    isOffline: !isConnected || !isInternetReachable,
  };
}
