export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
}

export interface NetworkProvider {
  /** One-shot fetch of current connectivity state. */
  fetch(): Promise<NetworkState>;
  /**
   * Subscribe to connectivity changes. The handler fires immediately with the
   * current state, then on every subsequent change.
   * Returns an unsubscribe function — call it on cleanup.
   */
  subscribe(handler: (state: NetworkState) => void): () => void;
}
