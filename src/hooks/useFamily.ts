import { useEffect } from 'react';

import { useFamilyContext } from '../context/FamilyContext';
import type { FamilyConnection, FamilyInvitation, FamilyMember, FamilyPermissions } from '../models/Family';

export interface UseFamilyReturn {
  members: FamilyMember[];
  pendingInvitations: FamilyInvitation[];
  sentInvitations: FamilyInvitation[];
  isLoading: boolean;
  error: string | null;
  inviteMember(toPhone: string, relationship: string): Promise<void>;
  acceptInvitation(invitationId: string): Promise<FamilyConnection>;
  declineInvitation(invitationId: string): Promise<void>;
  cancelInvitation(invitationId: string): Promise<void>;
  removeMember(connectionId: string): Promise<void>;
  updatePermissions(connectionId: string, permissions: FamilyPermissions): Promise<void>;
  refresh(): Promise<void>;
  startLiveUpdates(): () => void;
}

export function useFamily(): UseFamilyReturn {
  return useFamilyContext();
}

/**
 * The family, with status kept live for as long as the calling screen is
 * mounted — Family (S2b) and Watch live (S2c). Everywhere else uses
 * `useFamily`, which does not hold listeners open.
 */
export function useLiveFamily(): UseFamilyReturn {
  const family = useFamilyContext();
  const { startLiveUpdates } = family;
  useEffect(() => startLiveUpdates(), [startLiveUpdates]);
  return family;
}
