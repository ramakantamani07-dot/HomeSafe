import { useState } from 'react';

import { useAuthContext } from '../context/AuthContext';
import { useSOSContext } from '../context/SOSContext';
import { useJourneyContext } from '../context/JourneyContext';
import { useAccountDeletionContext } from '../context/AccountDeletionContext';
import { usePrivacy } from './usePrivacy';

export type AccountDeletionStage =
  | 'idle'
  | 'authenticating'
  | 'deleting'
  | 'done'
  | 'error';

export interface UseAccountDeletion {
  stage: AccountDeletionStage;
  confirmationText: string;
  setConfirmationText(text: string): void;
  /** True only when the user has typed exactly "DELETE". */
  canDelete: boolean;
  /** True when an active journey must be ended before deletion. */
  blockedByActiveJourney: boolean;
  /** True when an active SOS must be resolved before deletion. */
  blockedBySOS: boolean;
  partialErrors: string[];
  error: string | null;
  requiresRecentAuth: boolean;
  initiateDelete(): Promise<void>;
  reset(): void;
}

const CONFIRMATION_WORD = 'DELETE';

export function useAccountDeletion(): UseAccountDeletion {
  const { user } = useAuthContext();
  const { activeSOS } = useSOSContext();
  const { activeJourney } = useJourneyContext();
  const { biometricAvailable, unlockWithBiometric } = usePrivacy();
  const { deleteAccount } = useAccountDeletionContext();

  const [stage, setStage] = useState<AccountDeletionStage>('idle');
  const [confirmationText, setConfirmationText] = useState('');
  const [partialErrors, setPartialErrors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [requiresRecentAuth, setRequiresRecentAuth] = useState(false);

  const canDelete = confirmationText === CONFIRMATION_WORD;
  const blockedByActiveJourney = activeJourney !== null;
  const blockedBySOS = activeSOS !== null;

  const initiateDelete = async (): Promise<void> => {
    if (!canDelete || !user?.id || blockedByActiveJourney || blockedBySOS) return;

    // Biometric step: verify local identity before the destructive action.
    if (biometricAvailable) {
      setStage('authenticating');
      const passed = await unlockWithBiometric();
      if (!passed) {
        setStage('error');
        setError('Biometric authentication failed. Please try again.');
        return;
      }
    }

    setStage('deleting');
    setError(null);
    setRequiresRecentAuth(false);
    setPartialErrors([]);

    const result = await deleteAccount(user.id);

    if (result.success) {
      setStage('done');
      // Auth state listener fires with null → app auto-redirects to sign-in screen.
    } else {
      setStage('error');
      setError(result.error ?? 'Account deletion failed.');
      setRequiresRecentAuth(result.requiresRecentAuth);
      setPartialErrors(result.partialErrors);
    }
  };

  const reset = (): void => {
    setStage('idle');
    setConfirmationText('');
    setError(null);
    setRequiresRecentAuth(false);
    setPartialErrors([]);
  };

  return {
    stage,
    confirmationText,
    setConfirmationText,
    canDelete,
    blockedByActiveJourney,
    blockedBySOS,
    partialErrors,
    error,
    requiresRecentAuth,
    initiateDelete,
    reset,
  };
}
