import {
  TRACKING_CONFIGS,
  UNEASY_BOOST_MS,
  getTrackingConfig,
  isUneasyBoostActive,
} from '../models/TrackingConfig';

describe('isUneasyBoostActive', () => {
  const started = 1_000_000;

  it('is inactive when no boost was ever requested', () => {
    expect(isUneasyBoostActive(null, started)).toBe(false);
  });

  it('holds for the window and then stops, without anything having to fire', () => {
    // This is the guarantee the spec asks for: the boost ends because the
    // arithmetic says so, not because a callback ran. A timer that was frozen
    // by backgrounding, or killed with the screen that started it, cannot
    // strand the device at a raised sampling rate.
    expect(isUneasyBoostActive(started, started)).toBe(true);
    expect(isUneasyBoostActive(started, started + UNEASY_BOOST_MS - 1)).toBe(true);
    expect(isUneasyBoostActive(started, started + UNEASY_BOOST_MS)).toBe(false);
    expect(isUneasyBoostActive(started, started + UNEASY_BOOST_MS * 100)).toBe(false);
  });

  it('is 15 minutes, per the spec', () => {
    expect(UNEASY_BOOST_MS).toBe(15 * 60 * 1_000);
  });
});

describe('UNEASY tracking config', () => {
  it('samples faster than a journey but slower than an SOS', () => {
    // Someone uneasy is not in an emergency; draining their battery at SOS
    // rates would be the wrong trade.
    expect(TRACKING_CONFIGS.UNEASY.timeInterval).toBeLessThan(
      TRACKING_CONFIGS.JOURNEY.timeInterval,
    );
    expect(TRACKING_CONFIGS.UNEASY.timeInterval).toBeGreaterThan(
      TRACKING_CONFIGS.SOS.timeInterval,
    );
  });

  it('outranks the low-battery downgrade, because the user asked for it', () => {
    const lowBattery = 0.05;
    const config = getTrackingConfig('UNEASY', lowBattery, 'MOVING');

    expect(config.mode).toBe('UNEASY');
    expect(config.timeInterval).toBe(TRACKING_CONFIGS.UNEASY.timeInterval);
  });

  it('still relaxes while stationary, which costs the user nothing', () => {
    const moving = getTrackingConfig('UNEASY', 1, 'MOVING');
    const still = getTrackingConfig('UNEASY', 1, 'STATIONARY');

    expect(still.timeInterval).toBe(moving.timeInterval * 2);
    expect(still.distanceInterval).toBe(moving.distanceInterval * 2);
  });

  it('never outranks SOS', () => {
    expect(getTrackingConfig('SOS', 1, 'MOVING').mode).toBe('SOS');
  });
});
