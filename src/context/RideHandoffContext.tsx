import React, { createContext, useCallback, useContext, useMemo } from 'react';

import type { Place } from '../models/Place';
import type { RideApp } from '../models/Ride';
import type { RideHandoffResult, RideHandoffService } from '../services/RideHandoffService';

interface RideHandoffContextValue {
  /** Ride apps WayLoc can open, in AP1's order. Empty until a credential is set. */
  availableApps: readonly RideApp[];
  /** Opens the app with the destination filled in. Never throws. */
  openRideApp(app: RideApp, destination: Place): Promise<RideHandoffResult>;
}

const RideHandoffContext = createContext<RideHandoffContextValue>({
  availableApps: [],
  openRideApp: async () => 'unavailable',
});

export function RideHandoffStateProvider({
  rideHandoffService,
  children,
}: {
  rideHandoffService: RideHandoffService;
  children: React.ReactNode;
}) {
  // Credentials are fixed for the life of the app, so this is read once.
  const availableApps = useMemo(() => rideHandoffService.availableApps(), [rideHandoffService]);
  const openRideApp = useCallback(
    (app: RideApp, destination: Place) => rideHandoffService.open(app, destination),
    [rideHandoffService],
  );
  const value = useMemo(() => ({ availableApps, openRideApp }), [availableApps, openRideApp]);
  return <RideHandoffContext.Provider value={value}>{children}</RideHandoffContext.Provider>;
}

export function useRideHandoffContext(): RideHandoffContextValue {
  return useContext(RideHandoffContext);
}
