import { useBatteryContext } from '../context/BatteryContext';

export function useBatteryStatus() {
  return useBatteryContext();
}
