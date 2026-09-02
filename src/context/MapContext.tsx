import React, { createContext, useContext } from 'react';

import type { MapProvider } from '../providers/MapProvider';

interface MapContextValue {
  mapProvider: MapProvider;
}

const MapContext = createContext<MapContextValue | null>(null);

export function MapStateProvider({
  mapProvider,
  children,
}: {
  mapProvider: MapProvider;
  children: React.ReactNode;
}) {
  return (
    <MapContext.Provider value={{ mapProvider }}>
      {children}
    </MapContext.Provider>
  );
}

export function useMapContext(): MapContextValue {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error('useMapContext must be used within MapStateProvider');
  return ctx;
}
