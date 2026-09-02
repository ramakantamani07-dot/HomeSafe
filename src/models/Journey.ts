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
};

/** Returns "lat, lng" rounded to 5 decimal places for display. */
export function formatCoordinates(coords: Coordinates): string {
  return `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
}
