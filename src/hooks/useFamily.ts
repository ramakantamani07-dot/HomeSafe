import { useEffect } from 'react';

import { useInterval } from './useInterval';

import { useFamilyContext } from '../context/FamilyContext';
import type {
  AskOkOutcome,
  FamilyConnection,
  FamilyInvitation,
  FamilyMember,
  FamilyPermissions,
  Watcher,
} from '../models/Family';
import { WATCH_HEARTBEAT_MS } from '../models/Family';

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
  watchers: Watcher[];
  announceWatching(member: FamilyMember): Promise<void>;
  stopWatching(member: FamilyMember): Promise<void>;
  askIfOk(member: FamilyMember): Promise<AskOkOutcome>;
  recordOk(): void;
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

/**
 * Tells `member` you are watching, for as long as the calling screen is
 * mounted (Watch live, S2c). Announced on mount, refreshed on a heartbeat,
 * withdrawn on unmount; if the app dies first, the announcement lapses by
 * itself. Paused in the background with the heartbeat — a screen nobody is
 * looking at is not someone watching.
 */
export function useWatchPresence(member: FamilyMember | undefined): void {
  const { announceWatching, stopWatching } = useFamilyContext();
  const memberId = member?.id;
  const connectionId = member?.connectionId;

  useEffect(() => {
    if (!member) return;
    announceWatching(member).catch(() => {});
    return () => {
      stopWatching(member).catch(() => {});
    };
    // Keyed on identity, not the object: live updates replace it constantly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, connectionId, announceWatching, stopWatching]);

  useInterval(
    () => {
      if (member) announceWatching(member).catch(() => {});
    },
    member ? WATCH_HEARTBEAT_MS : null,
  );
}
