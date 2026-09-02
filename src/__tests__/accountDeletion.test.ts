import { AccountDeletionService } from '../services/AccountDeletionService';
import type { AccountDeletionProvider } from '../providers/AccountDeletionProvider';
import type { AuthProvider } from '../providers/AuthProvider';
import type { OfflineQueueProvider } from '../providers/OfflineQueueProvider';
import type { StorageProvider } from '../providers/StorageProvider';

// ─── mock factories ───────────────────────────────────────────────────────────

function makeDeletionProvider(
  overrides: Partial<AccountDeletionProvider> = {},
): jest.Mocked<AccountDeletionProvider> {
  return {
    listAllJourneyIds: jest.fn(async () => []),
    deleteJourneySubCollections: jest.fn(async () => {}),
    deleteJourney: jest.fn(async () => {}),
    deleteAllContacts: jest.fn(async () => {}),
    deleteAllSosEvents: jest.fn(async () => {}),
    deleteUserDocument: jest.fn(async () => {}),
    removeDeviceToken: jest.fn(async () => {}),
    ...overrides,
  } as jest.Mocked<AccountDeletionProvider>;
}

function makeAuthProvider(
  overrides: Partial<AuthProvider> = {},
): jest.Mocked<AuthProvider> {
  return {
    sendOTP: jest.fn(),
    verifyOTP: jest.fn(),
    getCurrentUser: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(),
    deleteAuthAccount: jest.fn(async () => {}),
    ...overrides,
  } as jest.Mocked<AuthProvider>;
}

function makeQueueProvider(): jest.Mocked<OfflineQueueProvider> {
  return {
    enqueue: jest.fn(),
    getAll: jest.fn(async () => []),
    remove: jest.fn(),
    update: jest.fn(),
    clear: jest.fn(async () => {}),
    getByType: jest.fn(async () => []),
    getByStatus: jest.fn(async () => []),
  } as unknown as jest.Mocked<OfflineQueueProvider>;
}

function makeStorageProvider(
  overrides: Partial<StorageProvider> = {},
): jest.Mocked<StorageProvider> {
  return {
    getUser: jest.fn(async () => null),
    saveUser: jest.fn(async () => {}),
    updateUser: jest.fn(async () => {}),
    deleteUser: jest.fn(async () => {}),
    ...overrides,
  } as jest.Mocked<StorageProvider>;
}

function makeService(
  deletionProvider: AccountDeletionProvider,
  authProvider: AuthProvider,
  queueProvider: OfflineQueueProvider,
  storageProvider: StorageProvider,
) {
  return new AccountDeletionService(deletionProvider, authProvider, queueProvider, storageProvider);
}

// ─── 1. Successful deletion calls all steps in order ──────────────────────────

test('successful deletion calls all Firestore + auth steps', async () => {
  const deletion = makeDeletionProvider({
    listAllJourneyIds: jest.fn(async () => ['j1', 'j2']),
  });
  const auth = makeAuthProvider();
  const queue = makeQueueProvider();
  const storage = makeStorageProvider();
  const service = makeService(deletion, auth, queue, storage);

  const result = await service.deleteAccount('u1');

  expect(result.success).toBe(true);
  expect(result.requiresRecentAuth).toBe(false);
  expect(result.partialErrors).toHaveLength(0);

  // Token removal
  expect(deletion.removeDeviceToken).toHaveBeenCalledWith('u1');

  // Journey sub-collections then documents
  expect(deletion.deleteJourneySubCollections).toHaveBeenCalledWith('u1', 'j1');
  expect(deletion.deleteJourneySubCollections).toHaveBeenCalledWith('u1', 'j2');
  expect(deletion.deleteJourney).toHaveBeenCalledWith('u1', 'j1');
  expect(deletion.deleteJourney).toHaveBeenCalledWith('u1', 'j2');

  // Contacts, SOS, user document
  expect(deletion.deleteAllContacts).toHaveBeenCalledWith('u1');
  expect(deletion.deleteAllSosEvents).toHaveBeenCalledWith('u1');
  expect(deletion.deleteUserDocument).toHaveBeenCalledWith('u1');

  // Local cleanup
  expect(queue.clear).toHaveBeenCalled();
  expect(storage.deleteUser).toHaveBeenCalledWith('u1');

  // Auth account deleted LAST
  expect(auth.deleteAuthAccount).toHaveBeenCalled();
  const deleteAuthCallOrder = auth.deleteAuthAccount.mock.invocationCallOrder[0];
  const clearQueueCallOrder = queue.clear.mock.invocationCallOrder[0];
  expect(deleteAuthCallOrder).toBeGreaterThan(clearQueueCallOrder);
});

// ─── 2. Deletion blocked during active SOS (hook-level guard — but service allows it) ─

test('service itself does not reject during SOS — guard is in the hook', async () => {
  const deletion = makeDeletionProvider();
  const auth = makeAuthProvider();
  const queue = makeQueueProvider();
  const storage = makeStorageProvider();
  const service = makeService(deletion, auth, queue, storage);

  // The service has no SOS awareness. Callers (hook/screen) enforce that guard.
  const result = await service.deleteAccount('u1');
  expect(result.success).toBe(true);
});

// ─── 3. auth/requires-recent-login sets requiresRecentAuth flag ──────────────

test('auth/requires-recent-login is surfaced in result.requiresRecentAuth', async () => {
  const recentAuthError = Object.assign(new Error('Requires recent login'), {
    code: 'auth/requires-recent-login',
  });
  const deletion = makeDeletionProvider();
  const auth = makeAuthProvider({
    deleteAuthAccount: jest.fn(async () => { throw recentAuthError; }),
  });
  const queue = makeQueueProvider();
  const storage = makeStorageProvider();
  const service = makeService(deletion, auth, queue, storage);

  const result = await service.deleteAccount('u1');

  expect(result.success).toBe(false);
  expect(result.requiresRecentAuth).toBe(true);
  expect(result.error).toBeTruthy();
});

// ─── 4. Generic auth failure does NOT set requiresRecentAuth ──────────────────

test('generic auth failure returns success:false without requiresRecentAuth', async () => {
  const deletion = makeDeletionProvider();
  const auth = makeAuthProvider({
    deleteAuthAccount: jest.fn(async () => { throw new Error('network error'); }),
  });
  const queue = makeQueueProvider();
  const storage = makeStorageProvider();
  const service = makeService(deletion, auth, queue, storage);

  const result = await service.deleteAccount('u1');

  expect(result.success).toBe(false);
  expect(result.requiresRecentAuth).toBe(false);
});

// ─── 5. Partial Firestore failures are captured, deletion continues ───────────

test('partial Firestore errors do not abort the flow — partialErrors is populated', async () => {
  const deletion = makeDeletionProvider({
    listAllJourneyIds: jest.fn(async () => ['j1']),
    deleteJourneySubCollections: jest.fn(async () => { throw new Error('permission-denied'); }),
    deleteAllContacts: jest.fn(async () => { throw new Error('timeout'); }),
  });
  const auth = makeAuthProvider();
  const queue = makeQueueProvider();
  const storage = makeStorageProvider();
  const service = makeService(deletion, auth, queue, storage);

  const result = await service.deleteAccount('u1');

  // Auth account is still deleted despite partial failures
  expect(auth.deleteAuthAccount).toHaveBeenCalled();
  expect(result.success).toBe(true);
  expect(result.partialErrors.some((e) => e.includes('sub:j1'))).toBe(true);
  expect(result.partialErrors.some((e) => e === 'contacts')).toBe(true);
});

// ─── 6. Firestore data is deleted before the auth account ────────────────────

test('deleteUserDocument is called before deleteAuthAccount', async () => {
  const callOrder: string[] = [];
  const deletion = makeDeletionProvider({
    deleteUserDocument: jest.fn(async () => { callOrder.push('delete-user-doc'); }),
  });
  const auth = makeAuthProvider({
    deleteAuthAccount: jest.fn(async () => { callOrder.push('delete-auth'); }),
  });
  const queue = makeQueueProvider();
  const storage = makeStorageProvider();
  const service = makeService(deletion, auth, queue, storage);

  await service.deleteAccount('u1');

  expect(callOrder.indexOf('delete-user-doc')).toBeLessThan(
    callOrder.indexOf('delete-auth'),
  );
});

// ─── 7. removeDeviceToken failure does not block deletion ─────────────────────

test('removeDeviceToken failure is swallowed and deletion continues', async () => {
  const deletion = makeDeletionProvider({
    removeDeviceToken: jest.fn(async () => { throw new Error('offline'); }),
  });
  const auth = makeAuthProvider();
  const queue = makeQueueProvider();
  const storage = makeStorageProvider();
  const service = makeService(deletion, auth, queue, storage);

  const result = await service.deleteAccount('u1');

  expect(result.success).toBe(true);
  expect(auth.deleteAuthAccount).toHaveBeenCalled();
});

// ─── 8. Queue and local storage are cleared on success ────────────────────────

test('queue and local storage are cleared during account deletion', async () => {
  const deletion = makeDeletionProvider();
  const auth = makeAuthProvider();
  const queue = makeQueueProvider();
  const storage = makeStorageProvider();
  const service = makeService(deletion, auth, queue, storage);

  await service.deleteAccount('u1');

  expect(queue.clear).toHaveBeenCalledTimes(1);
  expect(storage.deleteUser).toHaveBeenCalledWith('u1');
});

// ─── 9. Storage provider without deleteUser is tolerated ──────────────────────

test('missing deleteUser on StorageProvider does not crash', async () => {
  const deletion = makeDeletionProvider();
  const auth = makeAuthProvider();
  const queue = makeQueueProvider();
  const storage = makeStorageProvider();
  // Simulate provider that doesn't implement the optional method
  delete (storage as Partial<StorageProvider>).deleteUser;
  const service = makeService(deletion, auth, queue, storage);

  const result = await service.deleteAccount('u1');
  expect(result.success).toBe(true);
});

// ─── 10. Active journey guard — enforced in the hook, not the service ──────────
// The service has no knowledge of journey state. The guard lives in
// useAccountDeletion (blockedByActiveJourney) so callers never reach the
// service when a journey is active. This test documents that architectural
// decision and ensures the service still succeeds when called directly.

test('service succeeds regardless of journey state — guard is in useAccountDeletion', async () => {
  const deletion = makeDeletionProvider();
  const auth = makeAuthProvider();
  const queue = makeQueueProvider();
  const storage = makeStorageProvider();
  const service = makeService(deletion, auth, queue, storage);

  const result = await service.deleteAccount('u1');
  expect(result.success).toBe(true);
  // Callers (the hook) check blockedByActiveJourney before calling this method.
});
