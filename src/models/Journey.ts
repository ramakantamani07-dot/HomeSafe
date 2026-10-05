import type { AlertRules } from './AlertRules';
import type { Place, TravelMode } from './Place';

export type JourneyStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'MISSED_CHECKIN' | 'SOS_TRIGGERED';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Journey {
  id: string;
  userId: string;
  destinationLabel: string;
  startLocation: Coordinates;
  /** Coordinates of the destination. Null when the user did not supply them. */
  destinationCoordinates: Coordinates | null;
  /**
   * Full destination record — name, formatted address, postcode, placeId.
   * Null only for journeys created before saved places existed, or by a code
   * path that couldn't resolve one; `destinationLabel` and
   * `destinationCoordinates` stay authoritative for display and routing so
   * nothing breaks when this is absent.
   */
  destination: Place | null;
  /** Id of the saved place this journey goes to, when it came from one. */
  savedPlaceId: string | null;
  /** How the user is travelling — drives the routing profile and ETA. */
  travelMode: TravelMode;
  /** Thresholds that raise a safety check. */
  alertRules: AlertRules;
  /** Metres from the destination that counts as arrived. */
  arrivalRadiusMeters: number;
  /** Most recent tracked position. Null until the first tracking update arrives. */
  currentLocation: Coordinates | null;
  status: JourneyStatus;
  startedAt: Date;
  endedAt: Date | null;
  createdAt: Date;
  /** Minutes between each required check-in. Null means no check-ins scheduled. */
  checkInIntervalMinutes: number | null;
  /** When the next check-in is due. Null when no interval set or journey has ended. */
  nextCheckInAt: Date | null;
  /** Metres along the calculated route. Null until routing succeeds. */
  routeDistanceMeters: number | null;
  /** Route travel time in seconds. Null until routing succeeds. */
  routeDurationSeconds: number | null;
  /** Estimated arrival time calculated at journey start. Null until routing succeeds. */
  initialEta: Date | null;
}

export type StartJourneyInput = {
  destinationLabel: string;
  startLocation: Coordinates;
  checkInIntervalMinutes: number | null;
  /** Coordinates to route to. Null means routing will not be attempted. */
  destinationCoordinates: Coordinates | null;
  destination: Place | null;
  savedPlaceId: string | null;
  travelMode: TravelMode;
  alertRules: AlertRules;
  arrivalRadiusMeters: number;
};

/** Returns "lat, lng" rounded to 5 decimal places for display. */
export function formatCoordinates(coords: Coordinates): string {
  return `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
}
