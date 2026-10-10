import { useCallback } from 'react';

import {
  IdentityNotConfirmedError,
  PROTECTED_ACTION_PROMPT,
  type ProtectedAction,
} from '../models/AccountProtection';
import { usePrivacy } from './usePrivacy';

/**
 * Wraps an action so it runs only after the phone's owner confirms it is them
 * (models/AccountProtection). Rejects with `IdentityNotConfirmedError` when
 * they cancel; screens let that pass silently.
 *
 * Applied in the hooks that own each protected action, so every screen that
 * reaches the action is covered, not just the ones remembered at the time.
 */
export function useIdentityGuard() {
  const { confirmIdentity } = usePrivacy();
  return useCallback(
    <A extends unknown[], R>(action: ProtectedAction, run: (...args: A) => Promise<R>) =>
      async (...args: A): Promise<R> => {
        if (!(await confirmIdentity(PROTECTED_ACTION_PROMPT[action]))) {
          throw new IdentityNotConfirmedError();
        }
        return run(...args);
      },
    [confirmIdentity],
  );
}
