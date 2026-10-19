import { lowBatteryMessage } from '../alerts/lowBattery';

describe('low-battery alert wording', () => {
  it('gives the level, the destination and a map link — and what will happen if it dies', () => {
    const m = lowBatteryMessage('Priya', 'Home', 9, { latitude: 12.975, longitude: 77.606 });
    expect(m.title).toBe("🔋 Priya's battery is low");
    expect(m.body).toBe(
      "Priya's phone is at 9% on the way to Home. Last location: https://maps.google.com/?q=12.97500,77.60600. " +
        'If it runs out, their location will stop updating.',
    );
    expect(m.sms).toMatch(/^wayLoc: Priya's phone is at 9% on the way to Home\. Last location: https:\/\/maps/);
  });

  it('says nothing about a location it does not have', () => {
    const m = lowBatteryMessage('Priya', 'Home', 9, undefined);
    expect(m.body).not.toMatch(/Last location/);
    expect(m.sms).not.toMatch(/Last location/);
  });
});
