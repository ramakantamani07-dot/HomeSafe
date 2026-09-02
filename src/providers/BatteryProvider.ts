export interface BatteryProvider {
  /** Returns current battery level from 0.0 (empty) to 1.0 (full). Returns 1.0 if unavailable. */
  getBatteryLevel(): Promise<number>;
  /**
   * Registers a callback that is called whenever the battery level changes.
   * Returns an unsubscribe function.
   */
  startMonitoring(onLevelChange: (level: number) => void): () => void;
}
