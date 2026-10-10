import type { DeviceRegistryProvider } from '../../providers/DeviceRegistryProvider';

/** In memory; there is no server to warn anyone in mock mode. */
export class MockDeviceRegistryProvider implements DeviceRegistryProvider {
  readonly registered = new Map<string, string | null>(); // userId → push token

  async register(userId: string, pushToken: string | null): Promise<void> {
    this.registered.set(userId, pushToken);
  }
}
