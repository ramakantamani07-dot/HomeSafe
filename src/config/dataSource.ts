import { isFirebaseConfigured } from './firebase';

/**
 * Decides whether the app runs on mock data or real backends — the single
 * place that answers that question.
 *
 * `EXPO_PUBLIC_DATA_SOURCE` controls it:
 *
 *   auto (default)  real when Firebase credentials are present, mock otherwise
 *   mock            always mock, even with credentials configured
 *   real            always real — throws at startup if credentials are missing
 *
 * Why `real` exists: under `auto`, a typo in `.env` silently falls back to
 * mocks. You would believe you were testing against Firestore while writing to
 * an in-memory map, and the app would look completely healthy. Setting `real`
 * before a release build turns that silent fallback into a loud failure.
 *
 * Why `mock` exists: once credentials are in `.env` they stay there, but you
 * still want to demo or test flows without writing to the real project. This
 * lets you keep the credentials and choose not to use them.
 */

export type DataSourceMode = 'auto' | 'mock' | 'real';

function readMode(): DataSourceMode {
  const raw = (process.env.EXPO_PUBLIC_DATA_SOURCE ?? 'auto').trim().toLowerCase();
  if (raw === 'mock' || raw === 'real' || raw === 'auto') return raw;
  throw new Error(
    `EXPO_PUBLIC_DATA_SOURCE must be "auto", "mock" or "real" — got "${raw}".`,
  );
}

export const dataSourceMode = readMode();

/**
 * True when every provider should use its `Mock*` implementation.
 *
 * Evaluated once at module load, like the providers it governs — the choice
 * cannot change at runtime, and pretending otherwise would invite code that
 * assumes it can.
 */
export const useMockData: boolean = (() => {
  switch (dataSourceMode) {
    case 'mock':
      return true;
    case 'real':
      if (!isFirebaseConfigured()) {
        throw new Error(
          'EXPO_PUBLIC_DATA_SOURCE=real but Firebase credentials are missing or ' +
            'incomplete. Check FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, ' +
            'FIREBASE_PROJECT_ID and FIREBASE_APP_ID in .env.',
        );
      }
      return false;
    case 'auto':
      return !isFirebaseConfigured();
  }
})();

/** One line for the startup log, so which mode is live is never a guess. */
export function describeDataSource(): string {
  const backend = useMockData ? 'MOCK (in-memory)' : 'REAL (Firebase)';
  return `wayLoc data source: ${backend} — mode "${dataSourceMode}"`;
}
