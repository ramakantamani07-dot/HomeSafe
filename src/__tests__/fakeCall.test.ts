/**
 * Fake Call Tests
 *
 * Pure unit tests for FakeCallService and FakeCallSettingsStore.
 * No React rendering, no real timers (jest.useFakeTimers), no real AsyncStorage.
 */

import { FakeCallService } from '../services/FakeCallService';
import { FakeCallSettingsStore } from '../implementations/fakeCall/FakeCallSettingsStore';
import { defaultFakeCallSettings } from '../models/FakeCall';
import type { FakeCallSettings } from '../models/FakeCall';

// ─── AsyncStorage mock ────────────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── FakeCallService ──────────────────────────────────────────────────────────

describe('FakeCallService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // 1. Immediate fake call
  test('fires immediately when delay is 0', () => {
    const service = new FakeCallService();
    const onFire = jest.fn();
    service.schedule(0, onFire);
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(service.isCountingDown()).toBe(false);
  });

  // 2. Delayed fake call
  test('fires after the specified delay seconds', () => {
    const service = new FakeCallService();
    const onFire = jest.fn();
    service.schedule(30, onFire);

    expect(onFire).not.toHaveBeenCalled();
    jest.advanceTimersByTime(29_000);
    expect(onFire).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1_000);
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  // 3. Cancelling the delay
  test('does not fire when cancelled before the delay elapses', () => {
    const service = new FakeCallService();
    const onFire = jest.fn();
    service.schedule(30, onFire);
    service.cancelPending();
    jest.advanceTimersByTime(30_000);
    expect(onFire).not.toHaveBeenCalled();
  });

  // 4. Accepting the call — after the timer fires the service has no pending state
  test('after the timer fires the service is ready for the next call', () => {
    const service = new FakeCallService();
    const first = jest.fn();
    service.schedule(10, first);
    jest.advanceTimersByTime(10_000);
    expect(first).toHaveBeenCalledTimes(1);
    expect(service.isCountingDown()).toBe(false);

    // A new call can be immediately scheduled (simulates user accepting and
    // later triggering another fake call).
    const second = jest.fn();
    service.schedule(0, second);
    expect(second).toHaveBeenCalledTimes(1);
  });

  // 5. Declining the call
  test('declining (cancel after incoming) leaves the service in a clean state', () => {
    const service = new FakeCallService();
    const onFire = jest.fn();
    service.schedule(10, onFire);
    jest.advanceTimersByTime(10_000);
    // Incoming fired — user declines. Context calls cancelPending (no-op: timer already done).
    service.cancelPending();
    expect(service.isCountingDown()).toBe(false);
    // A fresh call can be scheduled immediately after declining.
    const onFire2 = jest.fn();
    service.schedule(0, onFire2);
    expect(onFire2).toHaveBeenCalledTimes(1);
  });

  // 6. Ending the active call
  test('ending an active call resets the service so a new call can start', () => {
    const service = new FakeCallService();
    const onFire = jest.fn();
    service.schedule(0, onFire);
    expect(onFire).toHaveBeenCalledTimes(1);
    // User accepted, active call ends. cancelPending is a no-op here.
    service.cancelPending();
    expect(service.isCountingDown()).toBe(false);
    // New call can start.
    const onFire2 = jest.fn();
    service.schedule(5, onFire2);
    expect(service.isCountingDown()).toBe(true);
    jest.advanceTimersByTime(5_000);
    expect(onFire2).toHaveBeenCalledTimes(1);
  });

  // 7. Timer cleanup
  test('cancelPending is safe to call multiple times (no-throw)', () => {
    const service = new FakeCallService();
    service.cancelPending();
    service.cancelPending();
    service.schedule(10, jest.fn());
    service.cancelPending();
    service.cancelPending();
    expect(service.isCountingDown()).toBe(false);
  });

  // 8. Preventing duplicate timers
  test('scheduling a new call cancels the existing timer so only one fires', () => {
    const service = new FakeCallService();
    const first = jest.fn();
    const second = jest.fn();

    service.schedule(30, first);
    expect(service.isCountingDown()).toBe(true);

    // Second schedule replaces the first.
    service.schedule(10, second);
    jest.advanceTimersByTime(30_000);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  test('isCountingDown is true during delay and false once it fires', () => {
    const service = new FakeCallService();
    expect(service.isCountingDown()).toBe(false);
    service.schedule(10, () => {});
    expect(service.isCountingDown()).toBe(true);
    jest.advanceTimersByTime(10_000);
    expect(service.isCountingDown()).toBe(false);
  });
});

// ─── FakeCallSettingsStore ────────────────────────────────────────────────────

describe('FakeCallSettingsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  // 9. Saved caller preferences — load default
  test('load returns default settings when nothing is stored', async () => {
    const settings = await FakeCallSettingsStore.load();
    expect(settings).toEqual(defaultFakeCallSettings());
  });

  // 9. Saved caller preferences — round-trip save then load
  test('save persists settings and load retrieves them', async () => {
    const custom: FakeCallSettings = {
      callerName: 'Sarah',
      callerLabel: 'Mum',
      delaySeconds: 30,
    };
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    await FakeCallSettingsStore.save(custom);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'homesafe.fakecall.settings',
      JSON.stringify(custom),
    );

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(custom));
    const loaded = await FakeCallSettingsStore.load();
    expect(loaded).toEqual(custom);
  });

  test('load returns stored settings including all fields', async () => {
    const stored: FakeCallSettings = {
      callerName: 'Bob',
      callerLabel: 'Dad',
      delaySeconds: 10,
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(stored));
    const loaded = await FakeCallSettingsStore.load();
    expect(loaded.callerName).toBe('Bob');
    expect(loaded.callerLabel).toBe('Dad');
    expect(loaded.delaySeconds).toBe(10);
  });

  // 10. Offline operation — storage failure falls back to defaults
  test('load returns default settings when AsyncStorage throws (offline/unavailable)', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
      new Error('AsyncStorage is not available'),
    );
    const settings = await FakeCallSettingsStore.load();
    expect(settings).toEqual(defaultFakeCallSettings());
  });

  test('load returns default settings when stored JSON is malformed', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('{{not valid json}}');
    const settings = await FakeCallSettingsStore.load();
    expect(settings).toEqual(defaultFakeCallSettings());
  });
});
