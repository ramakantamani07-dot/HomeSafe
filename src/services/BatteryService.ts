import { LOW_BATTERY_THRESHOLD } from '../models/TrackingConfig';
import type { BatteryProvider } from '../providers/BatteryProvider';

export class BatteryService {
  private currentLevel = 1.0;
  private stopMonitoring: (() => void) | null = null;

  constructor(private readonly provider: BatteryProvider) {}

  async initialize(): Promise<number> {
    this.currentLevel = await this.provider.getBatteryLevel();
    return this.currentLevel;
  }

  startMonitoring(onChange: (level: number) => void): () => void {
    this.stopMonitoring?.();
    this.stopMonitoring = this.provider.startMonitoring((level) => {
      this.currentLevel = level;
      onChange(level);
    });
    return () => this.stop();
  }

  stop(): void {
    this.stopMonitoring?.();
    this.stopMonitoring = null;
  }

  getLevel(): number {
    return this.currentLevel;
  }

  isLowBattery(): boolean {
    return this.currentLevel < LOW_BATTERY_THRESHOLD;
  }
}
