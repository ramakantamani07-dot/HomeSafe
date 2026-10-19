import type { RideApp } from '../../models/Ride';
import type { RideAppLinks, RideAppProvider, RideDestination } from '../../providers/RideAppProvider';

/**
 * Uber's universal link (developer.uber.com/docs/deep-linking): opens the
 * Uber app when installed, otherwise the App Store / Play Store. No custom
 * scheme, so nothing to declare in Info.plist.
 *
 * - `pickup=my_location`: Uber uses its own GPS; WayLoc sends no position.
 * - `dropoff[formatted_address]` is what Uber shows; without it the drop-off
 *   does not display, so the address is sent whenever there is one.
 * - No `product_id`: it only works with an explicit pickup.
 * - Brackets are percent-encoded: they are not legal in a URL query, and an
 *   older iOS refuses to open a URL containing them.
 */
export class UberRideApp implements RideAppProvider {
  readonly app: RideApp = 'uber';

  constructor(private readonly clientId: string | undefined) {}

  isEnabled(): boolean {
    return Boolean(this.clientId?.trim());
  }

  links(destination: RideDestination): RideAppLinks {
    const params: Array<[string, string]> = [
      ['action', 'setPickup'],
      ['client_id', this.clientId?.trim() ?? ''],
      ['pickup', 'my_location'],
      ['dropoff[latitude]', String(destination.coordinates.latitude)],
      ['dropoff[longitude]', String(destination.coordinates.longitude)],
    ];
    if (destination.address) params.push(['dropoff[formatted_address]', destination.address]);
    const query = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    return {
      primary: `https://m.uber.com/ul/?${query}`,
      // Uber's web booking: only if the universal link cannot open at all.
      fallbacks: [`https://m.uber.com/?${query}`],
    };
  }
}
