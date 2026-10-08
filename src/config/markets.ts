/**
 * Emergency services by market.
 *
 * Exists because the number was hard-coded to `999` at three call sites in the
 * SOS screen. wayLoc ships to India, where 999 reaches nothing — and the Terms
 * already promise "999 in the UK, 112 in India", so the app was making a safety
 * claim the code could not keep.
 *
 * **Why 112 is the fallback rather than a per-country guess.** 112 is the GSM
 * standard: every GSM handset routes it to local emergency services, in the UK
 * and across the EU and India, and on most networks it connects even with no
 * SIM, no credit, or a locked keypad. If we cannot establish where someone is,
 * 112 is the number most likely to reach help — guessing a national number from
 * weak evidence would be worse than using the one designed for this case.
 *
 * North America is the notable exception and is listed explicitly: 112 is *not*
 * universally routed there, so an incorrect fallback would matter most exactly
 * where it is least recoverable.
 */
export interface Market {
  /** ISO 3166-1 alpha-2. */
  readonly code: string;
  readonly name: string;
  /** What the SOS screen dials, and what it tells the user it will dial. */
  readonly emergencyNumber: string;
}

/**
 * Markets with a number that differs from the 112 fallback, or where naming it
 * explicitly is worth more than relying on routing.
 */
export const MARKETS: Readonly<Record<string, Market>> = {
  GB: { code: 'GB', name: 'United Kingdom', emergencyNumber: '999' },
  IE: { code: 'IE', name: 'Ireland', emergencyNumber: '112' },
  IN: { code: 'IN', name: 'India', emergencyNumber: '112' },
  US: { code: 'US', name: 'United States', emergencyNumber: '911' },
  CA: { code: 'CA', name: 'Canada', emergencyNumber: '911' },
  AU: { code: 'AU', name: 'Australia', emergencyNumber: '000' },
  NZ: { code: 'NZ', name: 'New Zealand', emergencyNumber: '111' },
};

/** The GSM-standard number. See the note above for why this is the fallback. */
export const DEFAULT_EMERGENCY_NUMBER = '112';

/** Resolves the number to dial for a country, falling back deliberately. */
export function emergencyNumberFor(countryCode: string | null | undefined): string {
  if (!countryCode) return DEFAULT_EMERGENCY_NUMBER;
  return MARKETS[countryCode.toUpperCase()]?.emergencyNumber ?? DEFAULT_EMERGENCY_NUMBER;
}

/**
 * The market this build is configured for, if the operator pinned one.
 *
 * A single-market build (a UK-only release, say) should not depend on a device
 * setting that a traveller can change. Unset in a normal build, where the
 * device region is the better signal.
 */
const CONFIGURED_MARKET = process.env.EXPO_PUBLIC_MARKET ?? '';

/**
 * The device's region, e.g. "GB". Null when the platform will not say.
 *
 * Read through `Intl` rather than adding `expo-localization`: the value is
 * already there in Hermes, and a native module is a poor trade for one string.
 * Guarded because `Intl` support varies by engine build, and the failure mode
 * here has to be "fall back to 112", never "throw inside an emergency screen".
 */
function deviceRegion(): string | null {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    // "en-GB" → "GB"; "en" alone carries no region.
    const region = locale?.split('-')[1];
    return region && region.length === 2 ? region.toUpperCase() : null;
  } catch {
    return null;
  }
}

/**
 * The number this device should dial.
 *
 * Resolution order, strongest evidence first: an explicitly configured market,
 * then the device's own region, then the GSM standard.
 *
 * **This is not where the user physically is.** A traveller abroad keeps their
 * home region, and would be offered their home number. 112 covers that case on
 * any GSM network, which is part of why it is the fallback — but genuinely
 * location-aware emergency numbers would mean reverse-geocoding the current
 * position, which needs network and a fix precisely when both are least
 * reliable. Recorded as a known limitation rather than solved badly.
 */
export function localEmergencyNumber(): string {
  if (CONFIGURED_MARKET) return emergencyNumberFor(CONFIGURED_MARKET);
  return emergencyNumberFor(deviceRegion());
}
