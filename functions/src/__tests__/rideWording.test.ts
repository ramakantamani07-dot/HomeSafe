import { journeyStartWording, rideSosDetail } from '../alerts/rideWording';

const ride = (state: 'getting_ride' | 'in_ride', vehicleNumber: string | null = null) => ({ state, vehicleNumber });

describe('journey-start alert', () => {
  it('a walk reads as before', () => {
    expect(journeyStartWording('Priya', 'Home', { travelMode: 'walk', ride: null })).toEqual({
      sms: "wayLoc: Priya started a journey to Home. You'll be told if they miss a check-in.",
      title: 'Priya is on the way',
      body: 'Heading to Home.',
    });
  });

  it('a ride says "getting an auto" — she is not in it yet', () => {
    const w = journeyStartWording('Priya', 'Home', { travelMode: 'auto', ride: ride('getting_ride') });
    expect(w.sms).toBe("wayLoc: Priya is getting an auto to Home. You'll be told if they miss a check-in.");
    expect(w.title).toBe('Priya is getting an auto');
  });
});

describe('the ride in an SOS', () => {
  it('names the vehicle when she gave its number', () => {
    expect(rideSosDetail({ travelMode: 'auto', ride: ride('in_ride', 'KA 01 AB 1234') })).toBe(
      ' In an auto, vehicle KA 01 AB 1234.',
    );
    expect(rideSosDetail({ travelMode: 'cab', ride: ride('in_ride') })).toBe(' In a cab.');
  });

  it('says only "was getting" before she confirmed', () => {
    expect(rideSosDetail({ travelMode: 'bikeTaxi', ride: ride('getting_ride') })).toBe(' Was getting a bike taxi.');
  });

  it('adds nothing without a ride', () => {
    expect(rideSosDetail({ travelMode: 'walk', ride: null })).toBe('');
    expect(rideSosDetail(undefined)).toBe('');
  });
});
