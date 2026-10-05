/**
 * ExpoDeviceIntegrityProvider must never throw — jail-monkey's native module
 * throws when unlinked (unbuilt dev client, or a platform with no rebuild
 * since install), and a jailbreak check crashing app startup would be far
 * worse than the check simply being inconclusive.
 */

const mockJailMonkey = {
  isJailBroken: jest.fn(() => false),
  hookDetected: jest.fn(() => false),
};

jest.mock('jail-monkey', () => ({ default: mockJailMonkey }), { virtual: true });

import { ExpoDeviceIntegrityProvider } from '../implementations/security/ExpoDeviceIntegrityProvider';

beforeEach(() => {
  mockJailMonkey.isJailBroken.mockReturnValue(false);
  mockJailMonkey.hookDetected.mockReturnValue(false);
});

test('reports not compromised on a clean device', async () => {
  const provider = new ExpoDeviceIntegrityProvider();
  const result = await provider.checkIntegrity();
  expect(result).toEqual({ isCompromised: false, reasons: [] });
});

test('flags a jailbroken device', async () => {
  mockJailMonkey.isJailBroken.mockReturnValue(true);
  const provider = new ExpoDeviceIntegrityProvider();
  const result = await provider.checkIntegrity();
  expect(result.isCompromised).toBe(true);
  expect(result.reasons).toHaveLength(1);
});

test('flags hook detection independently of jailbreak status', async () => {
  mockJailMonkey.hookDetected.mockReturnValue(true);
  const provider = new ExpoDeviceIntegrityProvider();
  const result = await provider.checkIntegrity();
  expect(result.isCompromised).toBe(true);
});

test('treats an unlinked native module as inconclusive, not compromised', async () => {
  mockJailMonkey.isJailBroken.mockImplementation(() => {
    throw new Error("The package 'jail-monkey' doesn't seem to be linked.");
  });
  const provider = new ExpoDeviceIntegrityProvider();
  const result = await provider.checkIntegrity();
  expect(result).toEqual({ isCompromised: false, reasons: [] });
});
