import { useJourney } from './useJourney';
import { useActiveJourneyLocation } from './useActiveJourneyLocation';
import { useRoute } from './useRoute';
import type { MapMarker, MapRegion, RoutePolyline } from '../models/MapModels';
import type { Coordinates } from '../models/Journey';

export interface JourneyMapData {
  markers: MapMarker[];
  region: MapRegion;
  polyline: RoutePolyline | null;
}

// Fallback region shown before a journey is loaded (Central London).
const DEFAULT_REGION: MapRegion = {
  latitude: 51.5074,
  longitude: -0.1278,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const MIN_DELTA = 0.005;
const REGION_PADDING = 1.5; // 50% padding around the bounding box

/** Fits a region around a set of coordinates with padding. */
function regionFromCoords(coords: Coordinates[]): MapRegion {
  if (coords.length === 0) return DEFAULT_REGION;
  if (coords.length === 1) {
    return { latitude: coords[0].latitude, longitude: coords[0].longitude, latitudeDelta: MIN_DELTA, longitudeDelta: MIN_DELTA };
  }
  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * REGION_PADDING, MIN_DELTA),
    longitudeDelta: Math.max((maxLng - minLng) * REGION_PADDING, MIN_DELTA),
  };
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
    region: regionFromCoords(regionCoords),
    polyline,
  };
}
