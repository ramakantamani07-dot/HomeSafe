/**
 * Duress ("silent SOS") code: storage + the SOS-side "fake resolve" that
 * flags an event without touching status/resolvedAt so tracking and the
 * alert both keep running. See SOSContext.triggerDuress / useSOS.ts.
 */

const mockSecureStoreData = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockSecureStoreData.get(key) ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStoreData.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    mockSecureStoreData.delete(key);
    return Promise.resolve();
  }),
}));

import {
  isValidDuressCode,
  loadDuressCode,
  saveDuressCode,
  clearDuressCode,
} from '../implementations/storage/SecureDuressStore';
import { MockSOSProvider } from '../implementations/sos/MockSOSProvider';
import { MockJourneyProvider } from '../implementations/journey/MockJourneyProvider';
import { SOSService } from '../services/SOSService';

beforeEach(() => {
  mockSecureStoreData.clear();
});

describe('isValidDuressCode', () => {
  test('accepts 4-6 digit numeric codes', () => {
    expect(isValidDuressCode('1234')).toBe(true);
    expect(isValidDuressCode('123456')).toBe(true);
  });

  test('rejects anything else', () => {
    expect(isValidDuressCode('123')).toBe(false);
    expect(isValidDuressCode('1234567')).toBe(false);
    expect(isValidDuressCode('12ab')).toBe(false);
    expect(isValidDuressCode('')).toBe(false);
  });
});

describe('SecureDuressStore', () => {
  test('round-trips a saved code', async () => {
    expect(await loadDuressCode()).toBeNull();
    await saveDuressCode('4321');
    expect(await loadDuressCode()).toBe('4321');
  });

  test('clearing removes the stored code', async () => {
    await saveDuressCode('4321');
    await clearDuressCode();
    expect(await loadDuressCode()).toBeNull();
  });
});

describe('SOSService.triggerDuress', () => {
  test('flags the event without changing status or resolvedAt', async () => {
    const sosProvider = new MockSOSProvider();
    const journeyProvider = new MockJourneyProvider();
    const service = new SOSService(sosProvider, journeyProvider);

    const sos = await service.triggerSOS('user-1', null, null);
    await service.triggerDuress('user-1', sos.id);

    const stored = await sosProvider.getActiveSOS('user-1');
    expect(stored).not.toBeNull();
    expect(stored!.status).toBe('ACTIVE');
    expect(stored!.resolvedAt).toBeNull();
    expect(stored!.duressTriggered).toBe(true);
  });
});
