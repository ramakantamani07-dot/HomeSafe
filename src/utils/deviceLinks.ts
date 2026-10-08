import { Linking, Platform } from 'react-native';

/**
 * Handing off to the phone's own dialler, messages and maps.
 *
 * Every call fails silently. A device with no dialler (an iPad, the simulator)
 * should not throw an error dialog at someone who may already be worried —
 * the button simply does nothing, which is the honest outcome on that device.
 */

export function callNumber(phoneNumber: string): void {
  const scheme = Platform.OS === 'ios' ? 'tel://' : 'tel:';
  Linking.openURL(`${scheme}${phoneNumber}`).catch(() => {});
}

export function textNumber(phoneNumber: string): void {
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
