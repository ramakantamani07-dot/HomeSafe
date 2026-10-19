import type { Coordinates } from '../models/Journey';
import type { RideApp } from '../models/Ride';

/**
 * Where a ride app is asked to go. Deliberately no pickup and no name: the
 * ride app finds the traveller with its own GPS, and a WayLoc place name
 * ("Home") is never sent (docs/features/rides.md, decision 4).
 */
export interface RideDestination {
  coordinates: Coordinates;
  /** Street address or postcode (`rideDestinationAddress`). Null when there is none. */
  address: string | null;
}

/** The link to try first, then the ones to try if it will not open. */
export interface RideAppLinks {
  primary: string;
  fallbacks: string[];
}

/**
 * One ride app WayLoc can hand a destination to. Building the link is pure,
 * so each adapter's exact URL is tested; opening it is `LinkOpener`'s job.
 * WayLoc never books, prices or compares — the app takes over from here.
 */
export interface RideAppProvider {
  readonly app: RideApp;
  /** False when the app's credential is missing — the app is then not offered. */
  isEnabled(): boolean;
  links(destination: RideDestination): RideAppLinks;
}

/** Opens links outside WayLoc. */
export interface LinkOpener {
  /** Resolves false when the link could not be opened; never throws. */
  open(url: string): Promise<boolean>;
}
