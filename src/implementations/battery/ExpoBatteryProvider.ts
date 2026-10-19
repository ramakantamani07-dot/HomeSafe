import type { BatteryProvider } from '../../providers/BatteryProvider';

type BatteryModule = {
  getBatteryLevelAsync(): Promise<number>;
  addBatteryLevelListener(
    callback: (event: { batteryLevel: number }) => void,
  ): { remove(): void };
};

// expo-battery is an optional native module — not in package.json by default.
// Use a guarded require so the app compiles and runs without it installed;
// the provider falls back to reporting a full battery in that case.
let BatterySDK: BatteryModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  BatterySDK = require('expo-battery') as BatteryModule;
} catch {
  BatterySDK = null;
}

/**
 * expo-battery reports -1 when the level is unknown (the simulator, some
 * Android builds). The port's contract is "1.0 if unavailable" — passed
 * through, -1 reads as an empty battery and would tell someone's family their
 * phone is dying.
 */
function known(level: number): number {
  return Number.isFinite(level) && level >= 0 && level <= 1 ? level : 1.0;
}

export class ExpoBatteryProvider implements BatteryProvider {
  async getBatteryLevel(): Promise<number> {
    if (!BatterySDK) return 1.0;
    try {
      return known(await BatterySDK.getBatteryLevelAsync());
    } catch {
      return 1.0;
    }
  }

  startMonitoring(onLevelChange: (level: number) => void): () => void {
    if (!BatterySDK) return () => {};
    const subscription = BatterySDK.addBatteryLevelListener((event) => {
      onLevelChange(known(event.batteryLevel));
    });
    return () => subscription.remove();
  }
}
