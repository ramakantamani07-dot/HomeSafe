import type { RideApp } from '../../models/Ride';
import type { RideAppLinks, RideAppProvider, RideDestination } from '../../providers/RideAppProvider';

/**
 * Ola's documented links (developers.olacabs.com/docs/deep-linking). Ola
 * requires `utm_source` to be the XAPP token it issues to partners, so Ola is
 * not offered until `OLA_XAPP_TOKEN` is set.
 *
 * - The app link (`olacabs://`) first. If it will not open (the app is not
 *   installed), Ola's universal link, which opens the app or Ola's website.
 * - No `lat` / `lng`: Ola then takes the pickup from its own GPS.
 */
export class OlaRideApp implements RideAppProvider {
  readonly app: RideApp = 'ola';

  constructor(private readonly xappToken: string | undefined) {}

  isEnabled(): boolean {
    return Boolean(this.xappToken?.trim());
  }

  links(destination: RideDestination): RideAppLinks {
    const params: Array<[string, string]> = [
      ['utm_source', this.xappToken?.trim() ?? ''],
      ['landing_page', 'bk'],
      ['drop_lat', String(destination.coordinates.latitude)],
      ['drop_lng', String(destination.coordinates.longitude)],
    ];
    if (destination.address) params.push(['drop_address', destination.address]);
    const query = params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return {
      primary: `olacabs://app/launch?${query}`,
      fallbacks: [`https://olawebcdn.com/assets/ola-universal-link.html?${query}`],
    };
  }
}
