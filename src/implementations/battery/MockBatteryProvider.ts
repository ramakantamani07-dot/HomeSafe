import type { BatteryProvider } from '../../providers/BatteryProvider';

export class MockBatteryProvider implements BatteryProvider {
  private level: number;
  private listeners = new Set<(level: number) => void>();

  constructor(initialLevel = 0.8) {
    this.level = initialLevel;
  }

  async getBatteryLevel(): Promise<number> {
    return this.level;
  }

  startMonitoring(onLevelChange: (level: number) => void): () => void {
    this.listeners.add(onLevelChange);
    return () => { this.listeners.delete(onLevelChange); };
  }

  simulateLevelChange(level: number): void {
    this.level = level;
    this.listeners.forEach((l) => l(level));
  }
}
