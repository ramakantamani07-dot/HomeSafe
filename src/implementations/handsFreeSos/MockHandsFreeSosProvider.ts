import type { HandsFreeSosProvider, SosKeyGrant } from '../../providers/HandsFreeSosProvider';

/**
 * No server in mock mode: keys are issued locally and the endpoint is empty,
 * so Siri says plainly that a development build sent nothing.
 */
export class MockHandsFreeSosProvider implements HandsFreeSosProvider {
  readonly endpoint = '';
  readonly revoked: string[] = [];

  async registerKey(): Promise<SosKeyGrant> {
    const id = () => Math.random().toString(36).slice(2).padEnd(12, '0');
    return { keyId: `mock-${id()}${id()}`, key: `${id()}${id()}${id()}${id()}` };
  }

  async revokeKey(keyId: string): Promise<void> {
    this.revoked.push(keyId);
  }
}
