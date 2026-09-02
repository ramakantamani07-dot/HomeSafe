export interface LocationUpdate {
  latitude: number;
  longitude: number;
  /** Horizontal accuracy in metres. Null if unavailable. */
  accuracy: number | null;
  /** Heading in degrees (0–360). Null if unavailable. */
  heading: number | null;
  /** Speed in m/s. Null if unavailable. */
  speed: number | null;
  timestamp: Date;
}
