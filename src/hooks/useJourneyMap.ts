import { useJourney } from './useJourney';
import { useActiveJourneyLocation } from './useActiveJourneyLocation';
import { useRoute } from './useRoute';
import type { MapMarker, MapRegion, RoutePolyline } from '../models/MapModels';
import { DEFAULT_REGION, regionForPoints } from '../models/MapModels';
import type { Coordinates } from '../models/Journey';

export interface JourneyMapData {
  markers: MapMarker[];
  region: MapRegion;
  polyline: RoutePolyline | null;
}

export function useJourneyMap(): JourneyMapData {
  const { activeJourney } = useJourney();
  const { currentLocation } = useActiveJourneyLocation();
  const { route } = useRoute();

  if (!activeJourney) {
    return { markers: [], region: DEFAULT_REGION, polyline: null };
  }

  const markers: MapMarker[] = [
    {
      id: 'start',
      coordinate: activeJourney.startLocation,
      title: 'Start',
      role: 'start',
    },
  ];

  // Current location marker: only show when different from start
  if (
    currentLocation &&
    (currentLocation.latitude !== activeJourney.startLocation.latitude ||
      currentLocation.longitude !== activeJourney.startLocation.longitude)
  ) {
    markers.push({
      id: 'current',
      coordinate: currentLocation,
      title: 'You are here',
      role: 'current',
    });
  }

  // Destination marker: only when destination coordinates are available
  if (activeJourney.destinationCoordinates) {
    markers.push({
      id: 'destination',
      coordinate: activeJourney.destinationCoordinates,
      title: activeJourney.destinationLabel,
      role: 'destination',
    });
  }

  // Route polyline from RoutingContext
  const polyline: RoutePolyline | null = route
    ? { coordinates: route.coordinates }
    : null;

  // Region: fit the map to show both the user's position and the destination
  const regionCoords: Coordinates[] = [];
  const userPos = currentLocation ?? activeJourney.startLocation;
  regionCoords.push(userPos);
  if (activeJourney.destinationCoordinates) {
    regionCoords.push(activeJourney.destinationCoordinates);
  }

  return {
    markers,
    region: regionForPoints(regionCoords),
    polyline,
  };
}
