/**
 * Mobile numbers for the countries wayLoc signs people in from.
 *
 * Sign-in sends a text, so "valid" here means *a mobile number that can
 * receive one*, not any dialable number — a UK landline passes a general
 * validator and then never gets the code. Each rule is the national mobile
 * range, written out per country, instead of `libphonenumber-js` (Option 15
 * §4 suggests it). That library has one maintainer, which fails
 * `docs/architecture/DEPENDENCIES.md`, and ships metadata for ~240 countries
 * to validate seven. See decision D29 in the plan.
 *
 * Adding a country is one entry below; the tests in `phoneNumber.test.ts`
 * cover each rule.
 */
export interface Country {
  /** ISO 3166-1 alpha-2, matching `src/config/markets.ts`. */
  readonly iso: string;
  readonly dialCode: string;
  readonly flag: string;
  readonly name: string;
  /** The national mobile number, trunk prefix (0) already removed. */
  readonly mobile: RegExp;
  /** Digits per group when shown, e.g. [5, 5] → "98765 43210". */
  readonly groups: readonly number[];
}

export const COUNTRIES: readonly Country[] = [
  { iso: 'IN', dialCode: '+91', flag: '🇮🇳', name: 'India', mobile: /^[6-9]\d{9}$/, groups: [5, 5] },
  { iso: 'GB', dialCode: '+44', flag: '🇬🇧', name: 'United Kingdom', mobile: /^7\d{9}$/, groups: [4, 6] },
  { iso: 'US', dialCode: '+1', flag: '🇺🇸', name: 'United States', mobile: /^[2-9]\d{2}[2-9]\d{6}$/, groups: [3, 3, 4] },
  { iso: 'AU', dialCode: '+61', flag: '🇦🇺', name: 'Australia', mobile: /^4\d{8}$/, groups: [3, 3, 3] },
  { iso: 'SG', dialCode: '+65', flag: '🇸🇬', name: 'Singapore', mobile: /^[89]\d{7}$/, groups: [4, 4] },
  { iso: 'AE', dialCode: '+971', flag: '🇦🇪', name: 'UAE', mobile: /^5\d{8}$/, groups: [2, 3, 4] },
  { iso: 'MY', dialCode: '+60', flag: '🇲🇾', name: 'Malaysia', mobile: /^1\d{8,9}$/, groups: [2, 4, 4] },
];

/** The country sign-in starts on when the device gives no usable region. */
export const FALLBACK_COUNTRY: Country = COUNTRIES[0];

/** The country for a device region like "GB", or the fallback. */
export function countryForRegion(region: string | null | undefined): Country {
  const iso = region?.toUpperCase();
  return COUNTRIES.find((c) => c.iso === iso) ?? FALLBACK_COUNTRY;
}

/**
 * Digits only, with a leading trunk 0 removed: people type "07700 900123"
 * in the UK, and the 0 is never dialled after +44.
 */
export function nationalDigits(input: string): string {
  return input.replace(/\D/g, '').replace(/^0+/, '');
}

/** True when the number is a mobile in this country — what sends the code. */
export function isValidMobile(country: Country, input: string): boolean {
  return country.mobile.test(nationalDigits(input));
}

/** The longest national mobile number a country accepts, for `maxLength`. */
export function maxNationalLength(country: Country): number {
  // Groups describe the full-length number; spaces sit between them.
  const digits = country.groups.reduce((a, b) => a + b, 0);
  return digits + country.groups.length - 1;
}

/** "9876543210" → "98765 43210", following the country's grouping. */
export function formatNational(country: Country, input: string): string {
  const digits = nationalDigits(input);
  const parts: string[] = [];
  let at = 0;
  for (let i = 0; i < country.groups.length && at < digits.length; i++) {
    // The last group takes whatever is left, so a longer number still shows.
    const size = i === country.groups.length - 1 ? digits.length - at : country.groups[i];
    parts.push(digits.slice(at, at + size));
    at += size;
  }
  return parts.join(' ');
}

/** "+919876543210" — what the auth provider is given. */
export function toE164(country: Country, input: string): string {
  return `${country.dialCode}${nationalDigits(input)}`;
}

/** "+91 98765 43210", for "Sent to …". Unknown codes are shown as given. */
export function formatE164(e164: string): string {
  const country = [...COUNTRIES]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((c) => e164.startsWith(c.dialCode));
  if (!country) return e164;
  return `${country.dialCode} ${formatNational(country, e164.slice(country.dialCode.length))}`;
}
