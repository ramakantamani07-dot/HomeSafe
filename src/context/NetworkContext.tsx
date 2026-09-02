import React, { createContext, useContext, useEffect, useState } from 'react';
import type { NetworkProvider, NetworkState } from '../providers/NetworkProvider';

interface NetworkContextValue {
  isConnected: boolean;
  isInternetReachable: boolean;
}

const NetworkContext = createContext<NetworkContextValue>({
  isConnected: true,
  isInternetReachable: true,
});

export function NetworkStateProvider({
  networkProvider,
  children,
}: {
  networkProvider: NetworkProvider;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<NetworkContextValue>({
    isConnected: true,
    isInternetReachable: true,
  });

  useEffect(() => {
    const unsubscribe = networkProvider.subscribe((netState: NetworkState) => {
      setState({
        isConnected: netState.isConnected,
        isInternetReachable: netState.isInternetReachable,
      });
    });
    return unsubscribe;
  }, [networkProvider]);

  return (
    <NetworkContext.Provider value={state}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextValue {
  return useContext(NetworkContext);
}
