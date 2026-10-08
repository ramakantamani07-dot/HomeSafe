import { createMockAdapters } from './mockAdapters';
import type { NetworkLocationAdapters } from './ports';

/**
 * Chooses the adapters, once per instance.
 *
 * `NETWORK_LOCATION_ADAPTER=mock` selects the mocks. Anything else returns
 * null, and every caller treats null as "this feature is unavailable" — there
 * is no silent fallback to a mock in a deployed function. When G3 names the
 * providers, their adapters are added here, keyed the same way.
 */
let cached: NetworkLocationAdapters | null | undefined;

export function getAdapters(): NetworkLocationAdapters | null {
  if (cached !== undefined) return cached;

  switch (process.env.NETWORK_LOCATION_ADAPTER) {
    case 'mock':
      cached = createMockAdapters(process.env.MOCK_SMS_WEBHOOK_SECRET);
      break;
    default:
      cached = null;
  }
  return cached;
}

/** Test seam: inject adapters, or `undefined` to re-read the environment. */
export function setAdaptersForTesting(adapters: NetworkLocationAdapters | null | undefined): void {
  cached = adapters;
}
