import { useState } from 'react';

import { useSOSContext } from '../context/SOSContext';
import { usePrivacy } from './usePrivacy';

export type SOSResolveStage = 'idle' | 'authenticating' | 'resolving' | 'error';

export interface SOSResolveResult {
  success: boolean;
  error: string | null;
}

export function useSOS() {
  const sosCtx = useSOSContext();
  const { biometricAvailable, unlockWithBiometric } = usePrivacy();

  const [resolveStage, setResolveStage] = useState<SOSResolveStage>('idle');
  const [resolveError, setResolveError] = useState<string | null>(null);

  /**
   * Resolving an SOS ends the alert your contacts are seeing, so it gets the
   * same biometric gate as account deletion: raises friction for a coercer
   * forcing a "resolve", and blocks an accidental resolve from a
   * locked/pocketed device.
   */
  const resolveSOSWithAuth = async (): Promise<SOSResolveResult> => {
    if (!sosCtx.activeSOS) return { success: false, error: null };

    if (biometricAvailable) {
      setResolveStage('authenticating');
      const passed = await unlockWithBiometric();
      if (!passed) {
        const message = 'Biometric authentication failed. Please try again.';
        setResolveStage('error');
        setResolveError(message);
        return { success: false, error: message };
      }
    }

    setResolveStage('resolving');
    setResolveError(null);
    try {
      await sosCtx.resolveSOS();
      setResolveStage('idle');
      return { success: true, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not resolve the SOS. Please try again.';
      setResolveStage('error');
      setResolveError(message);
      return { success: false, error: message };
    }
  };

  return {
    ...sosCtx,
    resolveSOSWithAuth,
    resolveStage,
    resolveError,
  };
}
