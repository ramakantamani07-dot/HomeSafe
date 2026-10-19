import type { Place } from '../models/Place';
import type { RideApp } from '../models/Ride';
import { rideDestinationAddress } from '../models/Ride';
import type { LinkOpener, RideAppProvider } from '../providers/RideAppProvider';

export type RideHandoffResult =
  | 'opened'
  /** The app is not offered (no credential). */
  | 'unavailable'
  /** No usable coordinates to send. */
  | 'invalid_destination'
  /** A hand-off is already under way — a double tap. */
  | 'busy'
  /** Nothing would open. */
  | 'failed';

/**
 * Hands a destination to a ride app (docs/features/rides.md, Phase 3).
 *
 * The journey is started before this is called (decision 1): a link sends
 * nothing back, so this is the last moment WayLoc knows anything about the
 * ride. Screens never build links; they call `open`.
 */
export class RideHandoffService {
  private inFlight = false;

  constructor(
    private readonly apps: readonly RideAppProvider[],
    private readonly opener: LinkOpener,
  ) {}

  /** The apps to offer, in the order given (AP1). */
  availableApps(): RideApp[] {
    return this.apps.filter((a) => a.isEnabled()).map((a) => a.app);
  }

  async open(app: RideApp, destination: Place): Promise<RideHandoffResult> {
    const provider = this.apps.find((a) => a.app === app);
    if (!provider || !provider.isEnabled()) return 'unavailable';

    const { latitude, longitude } = destination.coordinates;
    const valid =
      Number.isFinite(latitude) && Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 &&
      !(latitude === 0 && longitude === 0);
    if (!valid) return 'invalid_destination';

    if (this.inFlight) return 'busy';
    this.inFlight = true;
    try {
      const { primary, fallbacks } = provider.links({
        coordinates: { latitude, longitude },
        address: rideDestinationAddress(destination),
      });
      for (const url of [primary, ...fallbacks]) {
        if (await this.opener.open(url)) return 'opened';
      }
      return 'failed';
    } finally {
      this.inFlight = false;
    }
  }
}
