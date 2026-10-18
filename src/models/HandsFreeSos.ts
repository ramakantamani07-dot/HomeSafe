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

/** How long "Test hands-free SOS" makes Siri triggers alert nobody. */
export const TEST_WINDOW_MS = 10 * 60 * 1000;

/** How often the last known position is saved for Siri during a journey. */
export const LOCATION_SAVE_INTERVAL_MS = 60 * 1000;

export function shouldSaveLocation(lastSavedAt: number | null, now: number): boolean {
  return lastSavedAt === null || now - lastSavedAt >= LOCATION_SAVE_INTERVAL_MS;
}
