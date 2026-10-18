import { handsFreeSosNative, isHandsFreeSosAvailable } from '../../../modules/hands-free-sos';
import type { SosVaultProvider } from '../../providers/HandsFreeSosProvider';

/** The iPhone Keychain, shared with the Siri extension (SosVault.swift). */
export class NativeSosVault implements SosVaultProvider {
  readonly available = isHandsFreeSosAvailable;
  save = handsFreeSosNative.saveCredentials;
  keyId = handsFreeSosNative.credentialsKeyId;
  setTestUntil = handsFreeSosNative.setTestUntil;
  saveLastLocation = handsFreeSosNative.saveLastLocation;
  clear = handsFreeSosNative.clear;
}
