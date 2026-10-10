import { onCall, type CallableRequest } from 'firebase-functions/v2/https';

import { metric } from './metrics';

/**
 * App Check for the functions the app calls (docs/reference/APP_CHECK.md).
 *
 * App Check proves a request came from the real wayLoc app on a genuine device
 * (Apple App Attest, Google Play Integrity), not from a script holding a
 * login. Every callable the app uses goes through `appCallable`, which:
 *
 *  - always records whether the request carried a valid App Check token
 *    (`metric:app_check`), so real traffic can be watched before anything is
 *    refused — step 4 of the rollout;
 *  - refuses requests without one only when `APP_CHECK_MODE=enforce`.
 *
 * **Monitor is the default**, and anything other than the exact word
 * `enforce` means monitor. Enforcing before the app sends tokens would turn
 * off Find, Ask "OK?" and test alerts for every real user, so it has to be
 * asked for by name. The mode is read when functions load, which for a
 * deployed function is deploy time: change it in functions/.env and redeploy.
 *
 * Not for the three HTTP endpoints. The SMS and voice webhooks are called by
 * the providers, which cannot attest, and are guarded by the provider's
 * signature instead; the tracking link is opened by anyone the traveller
 * shares it with, and is guarded by its share token.
 */
export type AppCheckMode = 'monitor' | 'enforce';

export function appCheckMode(env: NodeJS.ProcessEnv = process.env): AppCheckMode {
  return env.APP_CHECK_MODE?.trim().toLowerCase() === 'enforce' ? 'enforce' : 'monitor';
}

/** What the metric records about one request. No ids, no personal data. */
export function appCheckOutcome(
  request: Pick<CallableRequest, 'app'>,
): 'verified' | 'missing' {
  return request.app ? 'verified' : 'missing';
}

/** `onCall` for a function the app calls, with App Check monitored or enforced. */
export function appCallable<T = unknown, R = unknown>(
  name: string,
  handler: (request: CallableRequest<T>) => R | Promise<R>,
) {
  const mode = appCheckMode();
  return onCall<T>({ enforceAppCheck: mode === 'enforce' }, (request) => {
    metric('app_check', { fn: name, mode, outcome: appCheckOutcome(request) });
    return handler(request);
  });
}
