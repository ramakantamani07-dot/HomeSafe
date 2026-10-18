import { Platform } from 'react-native';

import { handsFreeSosNative, isHandsFreeSosAvailable } from '../../../modules/hands-free-sos';
import type { SosVaultProvider } from '../../providers/HandsFreeSosProvider';

/** The Siri extension is an ExtensionKit extension, which needs iOS 17. */
const MIN_IOS_MAJOR = 17;

function iosMajor(): number {
  return Platform.OS === 'ios' ? parseInt(String(Platform.Version), 10) : 0;
}

/** The iPhone Keychain, shared with the Siri extension (SosVault.swift). */
export class NativeSosVault implements SosVaultProvider {
  // On iOS 15–16 the module exists but the Siri extension cannot run, so the
  // feature is not offered rather than offered and silent.
  readonly available = isHandsFreeSosAvailable && iosMajor() >= MIN_IOS_MAJOR;
  save = handsFreeSosNative.saveCredentials;
  keyId = handsFreeSosNative.credentialsKeyId;
  setTestUntil = handsFreeSosNative.setTestUntil;
  saveLastLocation = handsFreeSosNative.saveLastLocation;
  clear = handsFreeSosNative.clear;
}
