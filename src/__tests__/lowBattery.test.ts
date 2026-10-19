import { JourneyService } from '../services/JourneyService';
import { MockJourneyProvider } from '../implementations/journey/MockJourneyProvider';
import { MockLocationProvider } from '../implementations/location/MockLocationProvider';
import { DEFAULT_ALERT_RULES, isLowBatteryForAlert } from '../models/AlertRules';
import type { Place } from '../models/Place';

const DEST: Place = {
  name: 'Home',
  formattedAddress: '14 MG Road, Bengaluru 560001',
  postcode: '560001',
  coordinates: { latitude: 12.975, longitude: 77.606 },
  placeId: null,
};
const HERE = { latitude: 12.97, longitude: 77.6 };

describe('"Battery under 10% → Send last location"', () => {
  it('is below the journey\'s threshold, never at it, and never an unknown reading', () => {
    expect(isLowBatteryForAlert(9, DEFAULT_ALERT_RULES)).toBe(true);
    expect(isLowBatteryForAlert(10, DEFAULT_ALERT_RULES)).toBe(false);
    expect(isLowBatteryForAlert(-100, DEFAULT_ALERT_RULES)).toBe(false);
    expect(isLowBatteryForAlert(14, { ...DEFAULT_ALERT_RULES, lowBatteryPercent: 15 })).toBe(true);
  });

  async function start() {
    const provider = new MockJourneyProvider();
    const service = new JourneyService(provider, new MockLocationProvider());
    const journey = await service.startJourney('u1', { destination: DEST });
    return { provider, service, journey };
  }

  it('marks the journey once, with the latest position — the server sends it from there', async () => {
    const { provider, service, journey } = await start();
    const spy = jest.spyOn(provider, 'markLowBattery');

    const above = await service.reportLowBattery('u1', journey, 40, HERE);
    expect(above).toBe(journey);
    expect(spy).not.toHaveBeenCalled();

    const low = await service.reportLowBattery('u1', journey, 9, HERE);
    expect(low.lowBatteryReportedAt).not.toBeNull();
    expect(spy).toHaveBeenCalledWith('u1', journey.id, 9, HERE);

    // Lower still: already sent for this journey.
    expect(await service.reportLowBattery('u1', low, 5, HERE)).toBe(low);
    expect(spy).toHaveBeenCalledTimes(1);
    expect((await service.getActiveJourney('u1'))?.lowBatteryReportedAt).not.toBeNull();
  });

  it('a new journey can send it again', async () => {
    const { service, journey } = await start();
    await service.reportLowBattery('u1', journey, 8, HERE);
    await service.endJourney('u1', journey.id);
    const next = await service.startJourney('u1', { destination: DEST });
    expect(next.lowBatteryReportedAt).toBeNull();
    expect((await service.reportLowBattery('u1', next, 8, HERE)).lowBatteryReportedAt).not.toBeNull();
  });
});
