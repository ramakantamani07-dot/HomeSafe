import type { Coordinates } from '../models/Journey';
import type { SafePlace } from '../models/SafePlace';

/**
 * Finds somewhere to head for when a traveller feels uneasy.
 *
 * **A separate port from `PlacesProvider`, deliberately.** The phase plan
 * originally called for a `searchOpenNearby` method on that interface, written
 * before we established that CLGeocoder — the free tier backing address search
 * — cannot do point-of-interest lookup at all. Adding the method there would
 * force `PlatformGeocoderPlacesProvider` to implement something it has no way
 * to answer, and returning an empty array from it would make the feature
 * silently dead on the default configuration.
 *
 * Concrete implementations:
 *  - MapKitSafePlaceProvider — MKLocalSearch, free and keyless, iOS only
 *  - MockSafePlaceProvider   — fixtures, for dev, CI and Android until a
 *                              keyless Android source exists
 */
export interface SafePlaceProvider {
  /** Nearest trustworthy places to `near`, already ranked. Empty when none. */
  findNearby(near: Coordinates): Promise<SafePlace[]>;
}
