import Constants from 'expo-constants';

/**
 * Ride-app credentials from `app.config.ts` (`UBER_CLIENT_ID`,
 * `OLA_XAPP_TOKEN` in `.env`). Public by nature — each appears in the links
 * WayLoc opens — but kept out of source so each build can use its own.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as { uberClientId?: string; olaXappToken?: string };

export const RIDE_APP_CONFIG = {
  uberClientId: extra.uberClientId,
  olaXappToken: extra.olaXappToken,
} as const;
