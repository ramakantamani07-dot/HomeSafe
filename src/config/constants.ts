/**
 * Non-visual app constants.
 *
 * Colours, fonts, spacing and radii deliberately do NOT live here — they
 * belong to the design system in `src/config/theme/`. A second palette in
 * this file is how the app ended up with two sources of colour truth once
 * already; don't reintroduce one.
 */

export const TIMING = {
  otpExpirySeconds: 600,
  otpResendCooldownSeconds: 60,
} as const;

export const SECURE_STORE_KEYS = {
  session: 'wayloc.auth-session',
  privacyPreferences: 'wayloc.privacy-preferences',
  duressCode: 'wayloc.duress-code',
} as const;

/**
 * Public guardian tracking page — lives in the separate wayloc-web project
 * (Next.js, deployed on Vercel), not this app. See
 * wayloc-web/src/app/track/[token]/page.tsx.
 */
export const JOURNEY_TRACKING_WEB_BASE_URL = 'https://wayloc-web-psi.vercel.app';
