import { AppState } from 'react-native';

import { MockBatteryProvider } from '../implementations/battery/MockBatteryProvider';
import { BatteryService } from '../services/BatteryService';
import { LocationTrackingService } from '../services/LocationTrackingService';
import {
  getTrackingConfig,
  LOW_BATTERY_THRESHOLD,
  TRACKING_CONFIGS,
} from '../models/TrackingConfig';
import type { LocationProvider, LocationTrackingOptions, LocationUpdateHandler } from '../providers/LocationProvider';
import type { JourneyProvider } from '../providers/JourneyProvider';
import type { LocationUpdate } from '../models/LocationUpdate';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeUpdate(overrides: Partial<LocationUpdate> = {}): LocationUpdate {
  return {
    latitude: 51.5,
    longitude: -0.1,
    accuracy: 10,
    heading: null,
    speed: null,
    timestamp: new Date(),
    ...overrides,
  };
}

function makeLocationProvider(options: { usingBackground?: boolean } = {}) {
  let handler: LocationUpdateHandler | null = null;
  let tracking = false;
  let usingBackground = options.usingBackground ?? false;
  let backgroundPermissionGranted = true;

  const provider = {
    async emit(update: LocationUpdate): Promise<void> {
      if (handler) {
        const ret: unknown = handler(update);
        // The actual handler is async; await its Promise if present.
        if (ret instanceof Promise) await ret;
      }
    },
    async getCurrentLocation() { return { latitude: 0, longitude: 0 }; },
    async startTracking(_options: LocationTrackingOptions, onUpdate: LocationUpdateHandler) {
      handler = onUpdate;
      tracking = true;
    },
    async stopTracking() { handler = null; tracking = false; },
    isTracking() { return tracking; },
    isUsingBackgroundMode() { return usingBackground; },
    async hasBackgroundPermission() { return backgroundPermissionGranted; },
    async startGeofencing() { /* not exercised by these tests */ },
    async stopGeofencing() { /* not exercised by these tests */ },
    // Test-only hooks
    _setUsingBackground(value: boolean) { usingBackground = value; },
    _revokeBackgroundPermission() { backgroundPermissionGranted = false; },
  };

  return provider;
}

function makeJourneyProvider(): JourneyProvider & { saveCount: number } {
  const provider = {
    saveCount: 0,
    saveLocationUpdate: jest.fn(async () => { provider.saveCount++; }),
    // Stub remaining methods — tests don't call them
    createJourney: jest.fn(),
    updateJourneyStatus: jest.fn(),
    getActiveJourney: jest.fn(),
    saveRouteData: jest.fn(),
    listenActiveJourney: jest.fn(),
    listenCheckIn: jest.fn(),
    createCheckIn: jest.fn(),
    updateCheckIn: jest.fn(),
    getCheckIn: jest.fn(),
    clearCheckInForSOS: jest.fn(),
  } as unknown as JourneyProvider & { saveCount: number };
  return provider;
}

// ─── 1. getTrackingConfig: correct config per mode ──────────────────────────

describe('getTrackingConfig', () => {
  test('returns JOURNEY config for JOURNEY mode with good battery', () => {
    const cfg = getTrackingConfig('JOURNEY', 0.8, 'MOVING');
    expect(cfg.mode).toBe('JOURNEY');
    expect(cfg.accuracy).toBe('balanced');
    expect(cfg.batchSize).toBe(5);
  });

  // 2. low battery overrides mode to LOW_BATTERY
  test('returns LOW_BATTERY config when battery is below threshold', () => {
    const cfg = getTrackingConfig('JOURNEY', LOW_BATTERY_THRESHOLD - 0.01, 'MOVING');
    expect(cfg.mode).toBe('LOW_BATTERY');
    expect(cfg.accuracy).toBe('low');
    expect(cfg.timeInterval).toBeGreaterThan(TRACKING_CONFIGS.JOURNEY.timeInterval);
  });

  // 3. SOS priority — battery level is ignored
  test('returns SOS config when mode is SOS regardless of battery', () => {
    const cfg = getTrackingConfig('SOS', 0.05, 'MOVING');
    expect(cfg.mode).toBe('SOS');
    expect(cfg.accuracy).toBe('high');
    expect(cfg.batchSize).toBe(1);
  });

  // 4. stationary doubles timeInterval and distanceInterval
  test('doubles intervals for stationary JOURNEY tracking', () => {
    const moving = getTrackingConfig('JOURNEY', 0.8, 'MOVING');
    const stationary = getTrackingConfig('JOURNEY', 0.8, 'STATIONARY');
    expect(stationary.timeInterval).toBe(moving.timeInterval * 2);
    expect(stationary.distanceInterval).toBe(moving.distanceInterval * 2);
  });
});

// ─── 5. MockBatteryProvider returns initial level ───────────────────────────

test('MockBatteryProvider.getBatteryLevel returns initial level', async () => {
  const provider = new MockBatteryProvider(0.42);
  expect(await provider.getBatteryLevel()).toBe(0.42);
});

// ─── 6. MockBatteryProvider.simulateLevelChange triggers listeners ───────────

test('MockBatteryProvider notifies listeners on simulateLevelChange', () => {
  const provider = new MockBatteryProvider(0.8);
  const received: number[] = [];
  provider.startMonitoring((l) => received.push(l));
  provider.simulateLevelChange(0.1);
  expect(received).toEqual([0.1]);
});

// ─── 7. BatteryService.initialize calls getBatteryLevel ─────────────────────

test('BatteryService.initialize resolves to provider level', async () => {
  const provider = new MockBatteryProvider(0.65);
  const service = new BatteryService(provider);
  const level = await service.initialize();
  expect(level).toBe(0.65);
  expect(service.getLevel()).toBe(0.65);
});

// ─── 8. BatteryService.isLowBattery reflects threshold ───────────────────────

test('BatteryService.isLowBattery is true below threshold', async () => {
  const provider = new MockBatteryProvider(LOW_BATTERY_THRESHOLD - 0.01);
  const service = new BatteryService(provider);
  await service.initialize();
  expect(service.isLowBattery()).toBe(true);
});

test('BatteryService.isLowBattery is false above threshold', async () => {
  const provider = new MockBatteryProvider(0.9);
  const service = new BatteryService(provider);
  await service.initialize();
  expect(service.isLowBattery()).toBe(false);
});

// ─── 9. Batch upload: N updates accumulate before Firestore write ─────────────

test('batches journey location updates (batchSize=5)', async () => {
  const locProvider = makeLocationProvider();
  const journeyProvider = makeJourneyProvider();
  const service = new LocationTrackingService(locProvider, journeyProvider);

  await service.startTracking('u1', 'j1', () => {});

  // Send 4 updates — should NOT flush yet
  for (let i = 0; i < 4; i++) {
    await locProvider.emit(makeUpdate());
  }
  expect(journeyProvider.saveCount).toBe(0);

  // 5th update flushes the batch
  await locProvider.emit(makeUpdate());
  expect(journeyProvider.saveCount).toBe(5);

  await service.stopTracking();
});

// ─── 10. SOS mode: writes immediately (batchSize=1) ─────────────────────────

test('SOS mode writes each update immediately', async () => {
  const locProvider = makeLocationProvider();
  const journeyProvider = makeJourneyProvider();
  const service = new LocationTrackingService(locProvider, journeyProvider);

  service.setSOSActive(true);
  await service.startTracking('u1', 'j1', () => {});

  await locProvider.emit(makeUpdate());
  expect(journeyProvider.saveCount).toBe(1);

  await locProvider.emit(makeUpdate());
  expect(journeyProvider.saveCount).toBe(2);

  await service.stopTracking();
});

// ─── 11. Duplicate prevention ────────────────────────────────────────────────

test('calling startTracking twice for the same journey does not create duplicate subscription', async () => {
  const locProvider = makeLocationProvider();
  const journeyProvider = makeJourneyProvider();
  const service = new LocationTrackingService(locProvider, journeyProvider);

  await service.startTracking('u1', 'j1', () => {});
  const countBefore = service.subscriptionCount;

  await service.startTracking('u1', 'j1', () => {});
  expect(service.subscriptionCount).toBe(countBefore); // no extra subscription

  await service.stopTracking();
});

// ─── 12. Journey completion cleanup clears batch buffer ──────────────────────

test('stopTracking flushes buffered updates before stopping', async () => {
  const locProvider = makeLocationProvider();
  const journeyProvider = makeJourneyProvider();
  const service = new LocationTrackingService(locProvider, journeyProvider);

  await service.startTracking('u1', 'j1', () => {});

  // Send 3 updates (batchSize=5, so not yet flushed)
  for (let i = 0; i < 3; i++) {
    await locProvider.emit(makeUpdate());
  }
  expect(journeyProvider.saveCount).toBe(0);

  // stopTracking should flush the partial batch
  await service.stopTracking();
  expect(journeyProvider.saveCount).toBe(3);
});

// ─── 13. Subscription cleanup: stopTracking stops location provider ───────────

test('stopTracking calls location.stopTracking()', async () => {
  const locProvider = makeLocationProvider();
  const journeyProvider = makeJourneyProvider();
  const service = new LocationTrackingService(locProvider, journeyProvider);

  await service.startTracking('u1', 'j1', () => {});
  expect(service.isTracking()).toBe(true);

  await service.stopTracking();
  expect(service.isTracking()).toBe(false);
});

// ─── 14. SOS-only (null journeyId) does not write to Firestore ───────────────

test('SOS-only tracking (null journeyId) forwards coords but skips Firestore', async () => {
  const locProvider = makeLocationProvider();
  const journeyProvider = makeJourneyProvider();
  const service = new LocationTrackingService(locProvider, journeyProvider);

  service.setSOSActive(true);

  const received: { latitude: number }[] = [];
  // null journeyId = SOS-only mode
  await service.startTracking('u1', null, (c) => received.push(c));

  await locProvider.emit(makeUpdate({ latitude: 99, longitude: 1 }));
  await locProvider.emit(makeUpdate({ latitude: 100, longitude: 2 }));

  // Coords forwarded to UI callback
  expect(received).toHaveLength(2);
  expect(received[0].latitude).toBe(99);

  // No Firestore writes (journeyId is null)
  expect(journeyProvider.saveCount).toBe(0);

  await service.stopTracking();
});

// ─── 15. Background permission downgrade detection ──────────────────────────
// There's no push-based OS event for a silent "Always" → "While Using"
// downgrade — detection only happens reactively, on app-foreground resume.
// These tests simulate that resume via the same AppState.addEventListener
// callback the service itself registers.

// AppState.addEventListener is a persistent mock (from the RN jest preset)
// whose call history isn't reset between tests in this file — take the LAST
// matching registration, not the first, so this always resolves to the
// handler this specific test's service instance just registered.
function getAppStateHandler(spy: jest.SpyInstance): (state: string) => void {
  const calls = spy.mock.calls.filter(([event]) => event === 'change');
  const lastCall = calls[calls.length - 1];
  if (!lastCall) throw new Error('AppState.addEventListener("change", ...) was not registered');
  return lastCall[1] as (state: string) => void;
}

// handleAppStateChange's permission re-check is fire-and-forget (not awaited
// by the caller), and hasBackgroundPermission() is itself an async function —
// several microtask hops separate calling the handler from the .then()
// callback actually running. A generous flush avoids a flaky one-tick guess.
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

test('fires onBackgroundPermissionRevoked when background mode was engaged but permission is later revoked', async () => {
  const addEventListenerSpy = jest.spyOn(AppState, 'addEventListener');
  const locProvider = makeLocationProvider({ usingBackground: true });
  const journeyProvider = makeJourneyProvider();
  const service = new LocationTrackingService(locProvider, journeyProvider);

  const revoked = jest.fn();
  service.onBackgroundPermissionRevoked = revoked;

  await service.startTracking('u1', 'j1', () => {});

  // Simulate the downgrade: background mode is no longer engaged and the OS
  // permission check now comes back denied.
  locProvider._setUsingBackground(false);
  locProvider._revokeBackgroundPermission();

  const handler = getAppStateHandler(addEventListenerSpy);
  handler('active');
  await flushMicrotasks();

  expect(revoked).toHaveBeenCalledTimes(1);

  await service.stopTracking();
  addEventListenerSpy.mockRestore();
});

test('does not fire onBackgroundPermissionRevoked when background mode was never engaged', async () => {
  const addEventListenerSpy = jest.spyOn(AppState, 'addEventListener');
  const locProvider = makeLocationProvider({ usingBackground: false });
  const journeyProvider = makeJourneyProvider();
  const service = new LocationTrackingService(locProvider, journeyProvider);

  const revoked = jest.fn();
  service.onBackgroundPermissionRevoked = revoked;

  await service.startTracking('u1', 'j1', () => {});

  const handler = getAppStateHandler(addEventListenerSpy);
  handler('active');
  await flushMicrotasks();

  expect(revoked).not.toHaveBeenCalled();

  await service.stopTracking();
  addEventListenerSpy.mockRestore();
});

test('does not fire onBackgroundPermissionRevoked when permission is still granted on resume', async () => {
  const addEventListenerSpy = jest.spyOn(AppState, 'addEventListener');
  // Background mode still reports true (no downgrade) even though this looks
  // like a resume — the service's own isUsingBackgroundMode() check short-
  // circuits before ever asking about permission.
  const locProvider = makeLocationProvider({ usingBackground: true });
  const journeyProvider = makeJourneyProvider();
  const service = new LocationTrackingService(locProvider, journeyProvider);

  const revoked = jest.fn();
  service.onBackgroundPermissionRevoked = revoked;

  await service.startTracking('u1', 'j1', () => {});

  const handler = getAppStateHandler(addEventListenerSpy);
  handler('active');
  await flushMicrotasks();

  expect(revoked).not.toHaveBeenCalled();

  await service.stopTracking();
  addEventListenerSpy.mockRestore();
});
