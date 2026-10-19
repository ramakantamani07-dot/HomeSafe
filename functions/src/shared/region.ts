import { setGlobalOptions } from 'firebase-functions/v2';

/**
 * Every function runs in Mumbai, beside the Firestore database (India launch,
 * docs/plan/IMPLEMENTATION_PHASES.md). Firestore triggers must sit in the
 * database's region, and an SOS should not cross an ocean twice.
 *
 * The app names the same region (`FUNCTIONS_REGION` in src/config/firebase.ts)
 * — for callables, and for the hands-free SOS URL the Siri extension calls.
 * Change both together.
 *
 * Imported first in index.ts: options set after a function is defined do not
 * apply to it.
 */
export const FUNCTIONS_REGION = 'asia-south1';

setGlobalOptions({ region: FUNCTIONS_REGION });
