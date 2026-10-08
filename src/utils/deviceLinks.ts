import { Alert, Linking, Platform } from 'react-native';

/**
 * Handing off to the phone's own dialler, messages and maps.
 *
 * Every call fails silently. A device with no dialler (an iPad, the simulator)
 * should not throw an error dialog at someone who may already be worried —
 * the button simply does nothing, which is the honest outcome on that device.
 */

/**
 * A number that cannot reach anyone: a placeholder (every digit after the
 * country code the same, like the demo family's +91 0000000000), or Ofcom's
 * range reserved for fiction, 07700 900000–900999.
 *
 * Handing one to the dialler does worse than nothing — on a phone with Screen
 * Time communication limits, iOS shows a "Ask a parent to approve" screen for
 * a person who does not exist, and its own "unknown error".
 */
export function isUnreachableNumber(phoneNumber: string): boolean {
  const digits = phoneNumber.replace(/\D/g, '');
  if (/^447700900\d{3}$/.test(digits)) return true;
  const national = digits.replace(/^(44|91|1)/, '');
  return national.length >= 6 && /^(\d)\1+$/.test(national);
}

function explainUnreachable(): void {
  Alert.alert(
    'Not a real number',
    "This person's number is a placeholder, so there's no one to reach. Real numbers call and text as normal.",
  );
}

export function callNumber(phoneNumber: string): void {
  if (isUnreachableNumber(phoneNumber)) return explainUnreachable();
  const scheme = Platform.OS === 'ios' ? 'tel://' : 'tel:';
  Linking.openURL(`${scheme}${phoneNumber}`).catch(() => {});
}

export function textNumber(phoneNumber: string): void {
  if (isUnreachableNumber(phoneNumber)) return explainUnreachable();
  Linking.openURL(`sms:${phoneNumber}`).catch(() => {});
}

/**
 * Directions in the OS maps app.
 *
 * Never a journey reroute: changing the destination would silently change
 * where guardians believe this person is going. Directions leave that true.
 */
export function openDirections(latitude: number, longitude: number, label: string): void {
  const url =
    Platform.OS === 'ios'
      ? `maps://?daddr=${latitude},${longitude}&q=${encodeURIComponent(label)}`
      : `geo:${latitude},${longitude}?q=${encodeURIComponent(label)}`;
  Linking.openURL(url).catch(() => {});
}
