import { UberRideApp } from '../implementations/rides/UberRideApp';
import { OlaRideApp } from '../implementations/rides/OlaRideApp';
import { MockLinkOpener } from '../implementations/rides/MockLinkOpener';
import { RideHandoffService } from '../services/RideHandoffService';
import { JourneyService } from '../services/JourneyService';
import { MockJourneyProvider } from '../implementations/journey/MockJourneyProvider';
import { MockLocationProvider } from '../implementations/location/MockLocationProvider';
import type { Place } from '../models/Place';

const HOME: Place = {
  name: 'Home',
  formattedAddress: "14 MG Road, Bengaluru 560001",
  postcode: '560001',
  coordinates: { latitude: 12.975, longitude: 77.606 },
  placeId: null,
};
const DEST = { coordinates: HOME.coordinates, address: HOME.formattedAddress };

describe('Uber link', () => {
  it('is the documented universal link: own GPS for pickup, the address for drop-off', () => {
    expect(new UberRideApp('abc123').links(DEST).primary).toBe(
      'https://m.uber.com/ul/?action=setPickup&client_id=abc123&pickup=my_location' +
        '&dropoff%5Blatitude%5D=12.975&dropoff%5Blongitude%5D=77.606' +
        '&dropoff%5Bformatted_address%5D=14%20MG%20Road%2C%20Bengaluru%20560001',
    );
  });

  it('falls back only to Uber\'s own web booking', () => {
    const { primary, fallbacks } = new UberRideApp('abc123').links(DEST);
    expect(fallbacks).toEqual([primary.replace('https://m.uber.com/ul/?', 'https://m.uber.com/?')]);
  });

  it('never carries a pickup position, a nickname or a product', () => {
    const url = decodeURIComponent(new UberRideApp('abc123').links(DEST).primary);
    expect(url).not.toMatch(/pickup\[|nickname|product_id|Home/);
  });

  it('leaves the address out when there is none, rather than sending a name', () => {
    expect(new UberRideApp('abc123').links({ ...DEST, address: null }).primary).not.toContain('formatted_address');
  });

  it('is not offered without a client id', () => {
    expect(new UberRideApp(undefined).isEnabled()).toBe(false);
    expect(new UberRideApp('  ').isEnabled()).toBe(false);
    expect(new UberRideApp('abc123').isEnabled()).toBe(true);
  });
});

describe('Ola link', () => {
  it('is the documented app link with the partner token, then the universal link', () => {
    const { primary, fallbacks } = new OlaRideApp('XAPP').links(DEST);
    const query =
      'utm_source=XAPP&landing_page=bk&drop_lat=12.975&drop_lng=77.606' +
      '&drop_address=14%20MG%20Road%2C%20Bengaluru%20560001';
    expect(primary).toBe(`olacabs://app/launch?${query}`);
    expect(fallbacks).toEqual([`https://olawebcdn.com/assets/ola-universal-link.html?${query}`]);
  });

  it('sends no pickup position and is hidden until Ola issues a token', () => {
    expect(new OlaRideApp('XAPP').links(DEST).primary).not.toMatch(/[?&](lat|lng)=/);
    expect(new OlaRideApp(undefined).isEnabled()).toBe(false);
  });
});

describe('RideHandoffService', () => {
  const apps = [new UberRideApp('abc123'), new OlaRideApp(undefined)];

  it('offers only apps with a credential, in order', () => {
    expect(new RideHandoffService(apps, new MockLinkOpener()).availableApps()).toEqual(['uber']);
  });

  it('opens the primary link', async () => {
    const opener = new MockLinkOpener();
    expect(await new RideHandoffService(apps, opener).open('uber', HOME)).toBe('opened');
    expect(opener.opened).toEqual([new UberRideApp('abc123').links(DEST).primary]);
  });

  it('falls through to the fallback, and says when nothing opened', async () => {
    const webOnly = new MockLinkOpener((url) => url.includes('/ul/'));
    expect(await new RideHandoffService(apps, webOnly).open('uber', HOME)).toBe('opened');
    expect(webOnly.opened[0]).toMatch(/^https:\/\/m\.uber\.com\/\?/);
    expect(await new RideHandoffService(apps, new MockLinkOpener(() => true)).open('uber', HOME)).toBe('failed');
  });

  it('refuses an app without a credential and a destination without coordinates', async () => {
    const service = new RideHandoffService(apps, new MockLinkOpener());
    expect(await service.open('ola', HOME)).toBe('unavailable');
    expect(await service.open('uber', { ...HOME, coordinates: { latitude: 0, longitude: 0 } })).toBe(
      'invalid_destination',
    );
    expect(await service.open('uber', { ...HOME, coordinates: { latitude: NaN, longitude: 1 } })).toBe(
      'invalid_destination',
    );
  });

  it('opens once on a double tap', async () => {
    const opener = new MockLinkOpener();
    const service = new RideHandoffService(apps, opener);
    const results = await Promise.all([service.open('uber', HOME), service.open('uber', HOME)]);
    expect(results.sort()).toEqual(['busy', 'opened']);
    expect(opener.opened).toHaveLength(1);
  });
});

describe('a journey that hands off to a ride app', () => {
  it('starts first, records the app it is about to open, and forgets it if the app never opened', async () => {
    const service = new JourneyService(new MockJourneyProvider(), new MockLocationProvider());
    const journey = await service.startJourney('u1', { destination: HOME, travelMode: 'cab', rideApp: 'uber' });
    expect(journey.ride).toMatchObject({ state: 'getting_ride', openedApp: 'uber' });

    const cleared = await service.clearOpenedApp('u1', journey);
    expect(cleared.ride).toMatchObject({ state: 'getting_ride', openedApp: null });
    expect((await service.getActiveJourney('u1'))?.ride?.openedApp).toBeNull();
  });

  it('a walk never has a ride app, whatever was picked', async () => {
    const service = new JourneyService(new MockJourneyProvider(), new MockLocationProvider());
    const journey = await service.startJourney('u1', { destination: HOME, travelMode: 'walk', rideApp: 'uber' });
    expect(journey.ride).toBeNull();
  });
});
