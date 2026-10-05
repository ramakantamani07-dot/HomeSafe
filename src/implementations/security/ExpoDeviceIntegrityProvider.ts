import type { DeviceIntegrityProvider, DeviceIntegrityResult } from '../../providers/DeviceIntegrityProvider';

export class ExpoDeviceIntegrityProvider implements DeviceIntegrityProvider {
  async checkIntegrity(): Promise<DeviceIntegrityResult> {
    const reasons: string[] = [];

    // jail-monkey's native module throws if it isn't linked (unbuilt dev
    // client, or a platform where the native code hasn't been rebuilt since
    // install) — treat that the same as "inconclusive", not "compromised".
    try {
      // Required lazily so a missing/unlinked native module can't crash
      // import-time app startup — same defensive pattern as the
      // expo-task-manager check in ExpoLocationProvider.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const JailMonkey = require('jail-monkey').default;

      if (JailMonkey.isJailBroken()) {
        reasons.push('Device appears to be jailbroken or rooted.');
      }
      if (JailMonkey.hookDetected()) {
        reasons.push('Runtime instrumentation (hooking) detected.');
      }
    } catch {
      return { isCompromised: false, reasons: [] };
    }

    return { isCompromised: reasons.length > 0, reasons };
  }
}
