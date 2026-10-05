import type { DeviceIntegrityProvider, DeviceIntegrityResult } from '../../providers/DeviceIntegrityProvider';

export class MockDeviceIntegrityProvider implements DeviceIntegrityProvider {
  result: DeviceIntegrityResult = { isCompromised: false, reasons: [] };

  async checkIntegrity(): Promise<DeviceIntegrityResult> {
    return this.result;
  }
}
