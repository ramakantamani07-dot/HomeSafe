import NetInfo from '@react-native-community/netinfo';
import type { NetworkProvider, NetworkState } from '../../providers/NetworkProvider';

function fromNetInfo(isConnected: boolean | null, isInternetReachable: boolean | null): NetworkState {
  return {
    isConnected: isConnected ?? false,
    isInternetReachable: isInternetReachable ?? false,
  };
}

export class NetInfoNetworkProvider implements NetworkProvider {
  async fetch(): Promise<NetworkState> {
    const state = await NetInfo.fetch();
    return fromNetInfo(state.isConnected, state.isInternetReachable);
  }

  subscribe(handler: (state: NetworkState) => void): () => void {
    return NetInfo.addEventListener((state) => {
      handler(fromNetInfo(state.isConnected, state.isInternetReachable));
    });
  }
}
