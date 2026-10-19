import { httpsCallable, type Functions } from 'firebase/functions';
import type { FirebaseApp } from 'firebase/app';

import type { HandsFreeSosProvider, SosKeyGrant } from '../../providers/HandsFreeSosProvider';
import { getAppFunctions, FUNCTIONS_REGION } from '../../config/firebase';

export class FirebaseHandsFreeSosProvider implements HandsFreeSosProvider {
  private readonly functions: Functions;
  readonly endpoint: string;

  constructor(app: FirebaseApp) {
    this.functions = getAppFunctions(app);
    this.endpoint = `https://${FUNCTIONS_REGION}-${app.options.projectId}.cloudfunctions.net/deviceSos`;
  }

  async registerKey(platform: 'ios' | 'android'): Promise<SosKeyGrant> {
    const call = httpsCallable<{ platform: string }, SosKeyGrant>(this.functions, 'registerSosKey');
    return (await call({ platform })).data;
  }

  async revokeKey(keyId: string): Promise<void> {
    const call = httpsCallable<{ keyId: string }, { revoked: number }>(this.functions, 'revokeSosKey');
    await call({ keyId });
  }
}
