import React, { createContext, useContext, useEffect, useState } from 'react';

import { LOW_BATTERY_THRESHOLD } from '../models/TrackingConfig';
import type { BatteryService } from '../services/BatteryService';

interface BatteryContextValue {
  batteryLevel: number;
  isLowBattery: boolean;
}

const BatteryContext = createContext<BatteryContextValue>({
  batteryLevel: 1.0,
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

  return (
    <BatteryContext.Provider
      value={{ batteryLevel, isLowBattery: batteryLevel < LOW_BATTERY_THRESHOLD }}
    >
      {children}
    </BatteryContext.Provider>
  );
}

export function useBatteryContext(): BatteryContextValue {
  return useContext(BatteryContext);
}
