import { JourneyService } from '../services/JourneyService';
import { MockJourneyProvider } from '../implementations/journey/MockJourneyProvider';
import { MockLocationProvider } from '../implementations/location/MockLocationProvider';
import type { Place } from '../models/Place';
import type { Ride } from '../models/Ride';
import {
  confirmInRide,
  initialRide,
  needsBookedWithQuestion,
  normaliseVehicleNumber,
  pickupMinutesLeft,
  rideDestinationAddress,
  rideHeadline,
  rideQuestion,
  rideSubtitle,
} from '../models/Ride';
import { expectedArrival } from '../models/TravelModeProfile';

const HOME: Place = {
  name: 'Home',
  formattedAddress: '14 MG Road, Bengaluru 560001',
  postcode: '560001',
  coordinates: { latitude: 12.975, longitude: 77.606 },
  placeId: null,
};

const START = new Date(2026, 9, 19, 21, 44);
const minutes = (n: number) => new Date(START.getTime() + n * 60_000);

describe('a ride on a journey', () => {
  it('only ride modes have one, and it starts waiting', () => {
    expect(initialRide('walk')).toBeNull();
    expect(initialRide('car')).toBeNull();
    expect(initialRide('auto')).toEqual({
      state: 'getting_ride',
      openedApp: null,
      bookedWith: null,
      confirmedAt: null,
      vehicleNumber: null,
    });
  });

  it('asks which app only when WayLoc opened one — opening Uber is not proof it is an Uber', () => {
    expect(needsBookedWithQuestion(initialRide('auto')!)).toBe(false);
    expect(needsBookedWithQuestion(initialRide('cab', 'uber')!)).toBe(true);
    const asked = confirmInRide(initialRide('cab', 'uber')!, minutes(6), 'other');
    expect(asked.bookedWith).toBe('other');
    expect(rideSubtitle(asked, START, minutes(7))).toBe('Confirmed 21:50');
  });

  it('says what it knows while waiting, and turns over to "still waiting" — on this phone only', () => {
    const ride = initialRide('auto')!;
    expect(rideHeadline(ride, 'auto', HOME, 'Home')).toBe('Getting an auto');
    expect(pickupMinutesLeft(START, minutes(4))).toBe(6);
    expect(rideSubtitle(ride, START, minutes(4))).toBe('Safe Journey on · pickup allowance 6 min left');
    expect(rideQuestion('auto', START, minutes(4))).toBe('Are you in the auto now?');
    expect(rideQuestion('auto', START, minutes(10))).toBe('Still waiting for your auto?');
    expect(rideSubtitle(ride, START, minutes(12))).toBe('Safe Journey on · pickup allowance used');
  });

  it('once in, names the ride and when they said so', () => {
    const ride = confirmInRide(initialRide('bikeTaxi', 'rapido')!, minutes(8), 'rapido');
    expect(rideHeadline(ride, 'bikeTaxi', HOME, 'Home')).toBe('In a bike taxi to 560001');
    expect(rideSubtitle(ride, START, minutes(9))).toBe('Confirmed 21:52 · booked with Rapido');
  });

  it('the drive counts from "Yes, I\'m in", not from the end of the allowance', () => {
    const drive = 14 * 60;
    // Waiting: allowance first.
    expect(expectedArrival('auto', drive, START, START)).toEqual(minutes(24));
    // In at 21:48: arrives 14 min later, not at 22:08.
    expect(expectedArrival('auto', drive, START, START, minutes(4))).toEqual(minutes(18));
    // In at 21:59 after a long wait: still a 14-min drive from then.
    expect(expectedArrival('auto', drive, START, START, minutes(15))).toEqual(minutes(29));
  });
});

describe('the address a ride app may be given', () => {
  it('is the street address — never the place\'s WayLoc name', () => {
    expect(rideDestinationAddress(HOME)).toBe('14 MG Road, Bengaluru 560001');
    expect(rideDestinationAddress({ ...HOME, formattedAddress: ' ' })).toBe('560001');
    expect(rideDestinationAddress({ ...HOME, formattedAddress: '', postcode: null })).toBeNull();
    expect(rideDestinationAddress(null)).toBeNull();
  });
});

describe('vehicle number', () => {
  it('is upper-cased free text, letters, digits and single spaces', () => {
    expect(normaliseVehicleNumber('mh 12  ab-1234')).toBe('MH 12 AB 1234');
    expect(normaliseVehicleNumber('ka01ab1234')).toBe('KA01AB1234');
    expect(normaliseVehicleNumber('  ')).toBeNull();
    expect(normaliseVehicleNumber('—')).toBeNull();
  });

  it('keeps at most 12 letters and digits', () => {
    expect(normaliseVehicleNumber('22 BH 1234 AA 99 77')).toBe('22 BH 1234 AA 99');
    expect(normaliseVehicleNumber('ABCDEFGHIJKLMNOP')).toBe('ABCDEFGHIJKL');
  });
});

describe('JourneyService rides', () => {
  async function start(mode: 'auto' | 'walk') {
    const provider = new MockJourneyProvider();
    const service = new JourneyService(provider, new MockLocationProvider());
    const journey = await service.startJourney('u1', { destination: HOME, travelMode: mode });
    return { provider, service, journey };
  }

  it('a ride journey starts in getting_ride and is stored that way', async () => {
    const { service, journey } = await start('auto');
    expect(journey.ride?.state).toBe('getting_ride');
    expect((await service.getActiveJourney('u1'))?.ride?.state).toBe('getting_ride');
  });

  it('"Yes, I\'m in" is saved before it is shown', async () => {
    const { service, journey } = await start('auto');
    const confirmed = await service.confirmInRide('u1', journey, null, minutes(5));
    expect(confirmed.ride).toMatchObject({ state: 'in_ride', confirmedAt: minutes(5), bookedWith: null });
    expect((await service.getActiveJourney('u1'))?.ride?.state).toBe('in_ride');
    // Confirming twice changes nothing.
    expect(await service.confirmInRide('u1', confirmed, 'uber', minutes(9))).toBe(confirmed);
  });

  it('the vehicle number is stored normalised, can be removed, and goes with the trail', async () => {
    const { provider, service, journey } = await start('auto');
    const inRide = await service.confirmInRide('u1', journey, null);
    const withNumber = await service.setVehicleNumber('u1', inRide, 'mh12 ab 1234');
    expect(withNumber.ride?.vehicleNumber).toBe('MH12 AB 1234');
    expect((await service.setVehicleNumber('u1', withNumber, '')).ride?.vehicleNumber).toBeNull();

    await service.setVehicleNumber('u1', inRide, 'KA01AB1234');
    await service.endJourney('u1', journey.id);
    await service.deleteJourneyHistory('u1');
    const [ended] = await provider.listJourneyHistory('u1');
    expect(ended.ride?.vehicleNumber).toBeNull();
  });

  it('a walk has no vehicle number to set', async () => {
    const { service, journey } = await start('walk');
    expect(await service.setVehicleNumber('u1', journey, 'KA01AB1234')).toBe(journey);
  });

  it('"Change travel" keeps the journey running with the new mode', async () => {
    const { service, journey } = await start('auto');
    const walking = await service.changeTravelMode('u1', journey, 'walk');
    expect(walking).toMatchObject({ id: journey.id, status: 'ACTIVE', travelMode: 'walk', ride: null });

    // The auto never came; a cab starts waiting afresh, the old ride's details gone.
    const inAuto: Ride = { ...journey.ride!, state: 'in_ride', vehicleNumber: 'KA01AB1234' };
    const cab = await service.changeTravelMode('u1', { ...journey, ride: inAuto }, 'cab');
    expect(cab.ride).toEqual(initialRide('cab'));
    expect((await service.getActiveJourney('u1'))?.travelMode).toBe('cab');
  });
});
