/**
 * DataExportService tests.
 *
 * Mocks expo-file-system and expo-sharing directly — same reasoning as the
 * expo-notifications mock in fakeCall.test.ts: there's no native binding in
 * the Jest environment, so without a mock the service's own try/catch would
 * silently swallow every call and every assertion would pass vacuously.
 */

const mockFileInstances: Array<{
  uri: string;
  exists: boolean;
  written: string | null;
  deleted: boolean;
}> = [];

jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    exists = false;
    written: string | null = null;
    deleted = false;

    constructor(..._uris: unknown[]) {
      this.uri = `file:///mock-cache/export-${mockFileInstances.length}.json`;
      mockFileInstances.push(this);
    }
    create() {
      this.exists = true;
    }
    write(content: string) {
      this.written = content;
    }
    delete() {
      this.deleted = true;
      this.exists = false;
    }
  }
  return {
    File: MockFile,
    Paths: { cache: 'mock-cache-dir' },
  };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

import { DataExportService } from '../services/DataExportService';
import { MockDataExportProvider } from '../implementations/export/MockDataExportProvider';
import type { StorageProvider } from '../providers/StorageProvider';
import type { User } from '../models/User';
import * as Sharing from 'expo-sharing';

const USER_ID = 'user-1';

function makeStorageProvider(user: User | null): StorageProvider {
  return {
    getUser: jest.fn().mockResolvedValue(user),
    saveUser: jest.fn(),
    updateUser: jest.fn(),
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    phone: '+919999900001',
    name: 'Alice',
    photoURL: null,
    fcmToken: '',
    settings: { rememberSession: true },
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  mockFileInstances.length = 0;
  jest.clearAllMocks();
});

test('exportMyData assembles profile, contacts, journeys, and sosEvents into one JSON file', async () => {
  const exportProvider = new MockDataExportProvider();
  const storageProvider = makeStorageProvider(makeUser());
  const service = new DataExportService(exportProvider, storageProvider);

  const result = await service.exportMyData(USER_ID);

  expect(result.success).toBe(true);
  expect(mockFileInstances).toHaveLength(1);

  const written = JSON.parse(mockFileInstances[0].written!);
  expect(written.profile).toEqual({ name: 'Alice', phone: '+919999900001', settings: { rememberSession: true } });
  expect(written.contacts).toHaveLength(1);
  expect(written.journeys).toHaveLength(1);
  expect(written.sosEvents).toEqual([]);
  expect(typeof written.exportedAt).toBe('string');
});

test('exportMyData hands the written file to the OS share sheet', async () => {
  const exportProvider = new MockDataExportProvider();
  const storageProvider = makeStorageProvider(makeUser());
  const service = new DataExportService(exportProvider, storageProvider);

  await service.exportMyData(USER_ID);

  expect(Sharing.shareAsync).toHaveBeenCalledWith(
    mockFileInstances[0].uri,
    expect.objectContaining({ mimeType: 'application/json' }),
  );
});

test('exportMyData fails cleanly when sharing is unavailable on the device', async () => {
  (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
  const exportProvider = new MockDataExportProvider();
  const storageProvider = makeStorageProvider(makeUser());
  const service = new DataExportService(exportProvider, storageProvider);

  const result = await service.exportMyData(USER_ID);

  expect(result.success).toBe(false);
  expect(result.error).toMatch(/sharing/i);
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
});

test('exportMyData still succeeds with a null profile (e.g. local profile missing)', async () => {
  const exportProvider = new MockDataExportProvider();
  const storageProvider = makeStorageProvider(null);
  const service = new DataExportService(exportProvider, storageProvider);

  const result = await service.exportMyData(USER_ID);

  expect(result.success).toBe(true);
  const written = JSON.parse(mockFileInstances[0].written!);
  expect(written.profile).toBeNull();
});

test('exportMyData reports failure if a provider read throws', async () => {
  const exportProvider = new MockDataExportProvider();
  exportProvider.exportContacts = jest.fn().mockRejectedValue(new Error('Firestore unavailable'));
  const storageProvider = makeStorageProvider(makeUser());
  const service = new DataExportService(exportProvider, storageProvider);

  const result = await service.exportMyData(USER_ID);

  expect(result.success).toBe(false);
  expect(result.error).toBe('Firestore unavailable');
});
