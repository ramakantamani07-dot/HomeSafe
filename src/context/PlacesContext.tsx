import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { Place, SavedPlace, SavedPlaceKind } from '../models/Place';
import type { PlacesService } from '../services/PlacesService';
import type { SavedPlaceService } from '../services/SavedPlaceService';
import { useAuthContext } from './AuthContext';

interface PlacesContextValue {
  /** Address search + reverse geocoding. Screens never touch a provider directly. */
  placesService: PlacesService;
  /** The user's "Your places" list, newest last. */
  savedPlaces: SavedPlace[];
  isLoading: boolean;
  /** Saves a destination for one-tap reuse. Returns the stored place. */
  savePlace(
    name: string,
    place: Place | null,
    kind?: SavedPlaceKind,
    arrivalRadiusMeters?: number,
  ): Promise<SavedPlace>;
  /** Fills in the address for an existing named slot (screen 03). */
  setPlaceAddress(
    savedPlaceId: string,
    place: Place,
    name?: string,
    arrivalRadiusMeters?: number,
  ): Promise<SavedPlace>;
  removePlace(savedPlaceId: string): Promise<void>;
  /** True when this destination already exists in the saved list. */
  isAlreadySaved(place: Place): boolean;
  /** Re-reads the list from the provider. */
  refresh(): Promise<void>;
}

const notMounted = () => {
  throw new Error('PlacesContext not mounted.');
};

const PlacesContext = createContext<PlacesContextValue>({
  placesService: null as unknown as PlacesService,
  savedPlaces: [],
  isLoading: false,
  savePlace: notMounted,
  setPlaceAddress: notMounted,
  removePlace: notMounted,
  isAlreadySaved: () => false,
  refresh: async () => {},
});

export function PlacesStateProvider({
  placesService,
  savedPlaceService,
  children,
}: {
  placesService: PlacesService;
  savedPlaceService: SavedPlaceService;
  children: React.ReactNode;
}) {
  const { user } = useAuthContext();
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userId = user?.id ?? null;

  const refresh = useCallback(async () => {
    if (!userId) {
      setSavedPlaces([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      setSavedPlaces(await savedPlaceService.list(userId));
    } catch {
      // A failed read leaves whatever list is already on screen — the search
      // field still works, so this shouldn't block starting a journey.
    } finally {
      setIsLoading(false);
    }
  }, [userId, savedPlaceService]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const savePlace = useCallback<PlacesContextValue['savePlace']>(
    async (name, place, kind = 'custom', arrivalRadiusMeters) => {
      if (!userId) throw new Error('You must be signed in to save a place.');
      const saved = await savedPlaceService.save(userId, name, place, kind, arrivalRadiusMeters);
      setSavedPlaces((current) => [...current, saved]);
      return saved;
    },
    [userId, savedPlaceService],
  );

  const setPlaceAddress = useCallback<PlacesContextValue['setPlaceAddress']>(
    async (savedPlaceId, place, name, arrivalRadiusMeters) => {
      if (!userId) throw new Error('You must be signed in to update a place.');
      const updated = await savedPlaceService.setAddress(
        userId,
        savedPlaceId,
        place,
        name,
        arrivalRadiusMeters,
      );
      setSavedPlaces((current) => current.map((p) => (p.id === savedPlaceId ? updated : p)));
      return updated;
    },
    [userId, savedPlaceService],
  );

  const removePlace = useCallback<PlacesContextValue['removePlace']>(async (savedPlaceId) => {
    if (!userId) return;
    await savedPlaceService.remove(userId, savedPlaceId);
    setSavedPlaces((current) => current.filter((p) => p.id !== savedPlaceId));
  }, [userId, savedPlaceService]);

  const isAlreadySaved = useCallback<PlacesContextValue['isAlreadySaved']>(
    (place) => savedPlaceService.isAlreadySaved(place, savedPlaces),
    [savedPlaceService, savedPlaces],
  );

  const value = useMemo<PlacesContextValue>(
    () => ({
      placesService,
      savedPlaces,
      isLoading,
      savePlace,
      setPlaceAddress,
      removePlace,
      isAlreadySaved,
      refresh,
    }),
    [
      placesService,
      savedPlaces,
      isLoading,
      savePlace,
      setPlaceAddress,
      removePlace,
      isAlreadySaved,
      refresh,
    ],
  );


  return <PlacesContext.Provider value={value}>{children}</PlacesContext.Provider>;
}

export function usePlacesContext(): PlacesContextValue {
  return useContext(PlacesContext);
}
