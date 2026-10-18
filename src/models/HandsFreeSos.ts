/**
 * Hands-free SOS (docs/features/hands-free-sos.md): "Siri, WayLoc help me",
 * the Action Button and Back Tap start the existing SOS without unlocking.
 */

/** What Siri listens for, as shown in Settings. Must match WayLocShortcuts in targets/sos-intent/SendSOSIntent.swift. */
export const SIRI_PHRASES = [
  'WayLoc help me',
  'Help me with WayLoc',
  'WayLoc SOS',
  'Send WayLoc SOS',
] as const;

/**
 * Also heard when Siri's language is Hindi, or English (India). Must match
 * targets/sos-intent/AppShortcuts.xcstrings.
 */
export const SIRI_PHRASES_HINDI = [
  'WayLoc मदद करो',
  'WayLoc बचाओ',
  'WayLoc से मदद चाहिए',
  'WayLoc एसओएस',
  'WayLoc एसओएस भेजो',
] as const;
export const SIRI_PHRASES_INDIAN_ENGLISH = ['WayLoc bachao', 'WayLoc madad karo'] as const;

/** How long "Test hands-free SOS" makes Siri triggers alert nobody. */
export const TEST_WINDOW_MS = 10 * 60 * 1000;

/** How often the last known position is saved for Siri during a journey. */
export const LOCATION_SAVE_INTERVAL_MS = 60 * 1000;

export function shouldSaveLocation(lastSavedAt: number | null, now: number): boolean {
  return lastSavedAt === null || now - lastSavedAt >= LOCATION_SAVE_INTERVAL_MS;
}
