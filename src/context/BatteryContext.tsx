import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { LOW_BATTERY_THRESHOLD } from '../models/TrackingConfig';
import type { BatteryService } from '../services/BatteryService';

interface BatteryContextValue {
  /**
   * Charge as a **fraction, 0–1** — the unit `expo-battery` reports and the one
   * `LOW_BATTERY_THRESHOLD` and the tracking tiers compare against.
   *
   * For anything shown to a person or stored in a field named "percent", use
   * `batteryPercent` instead. The two units living under one vaguely-named
   * value caused two real bugs: the journey screen rendered "Battery 0.64%",
   * and the safety-check escalation sent guardians a battery reading of "0.64".
   */
  batteryLevel: number;
  /** Charge as a whole-number **percentage, 0–100**. Use this for display. */
  batteryPercent: number;
  isLowBattery: boolean;
}

const BatteryContext = createContext<BatteryContextValue>({
  batteryLevel: 1.0,
  batteryPercent: 100,
  isLowBattery: false,
});

export function BatteryStateProvider({
  batteryService,
  children,
}: {
  batteryService: BatteryService;
  children: React.ReactNode;
}) {
  const [batteryLevel, setBatteryLevel] = useState(1.0);

  useEffect(() => {
    let mounted = true;

    batteryService.initialize().then((level) => {
      if (mounted) setBatteryLevel(level);
    }).catch(() => {});

    const stopMonitoring = batteryService.startMonitoring((level) => {
      if (mounted) setBatteryLevel(level);
    });

    return () => {
      mounted = false;
      stopMonitoring();
    };
  }, [batteryService]);

  const value = useMemo<BatteryContextValue>(
    () => ({
      batteryLevel,
      batteryPercent: Math.round(batteryLevel * 100),
      isLowBattery: batteryLevel < LOW_BATTERY_THRESHOLD,
    }),
    [batteryLevel],
  );

  return <BatteryContext.Provider value={value}>{children}</BatteryContext.Provider>;
}

export function useBatteryContext(): BatteryContextValue {
  return useContext(BatteryContext);
}
