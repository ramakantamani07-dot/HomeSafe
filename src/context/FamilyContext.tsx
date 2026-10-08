import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type {
  FamilyConnection,
  FamilyInvitation,
  FamilyMember,
  FamilyPermissions,
} from '../models/Family';
import type { FamilyService } from '../services/FamilyService';
import { useAuthContext } from './AuthContext';
import { useJourneyContext } from './JourneyContext';
import { useSOSContext } from './SOSContext';
import { useBatteryContext } from './BatteryContext';
import { useLocationTrackingContext } from './LocationTrackingContext';
import { useRoutingContext } from './RoutingContext';
import { useCheckInContext } from './CheckInContext';

interface FamilyContextValue {
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
  /**
   * Keeps members' status live until the returned function is called.
   * Counted, so two family screens open at once share one set of listeners.
   */
  startLiveUpdates(): () => void;
}

const FamilyContext = createContext<FamilyContextValue>({
  members: [],
  pendingInvitations: [],
  sentInvitations: [],
  isLoading: false,
  error: null,
  inviteMember: async () => {},
  acceptInvitation: async () => { throw new Error('FamilyContext not mounted.'); },
  declineInvitation: async () => {},
  cancelInvitation: async () => {},
  removeMember: async () => {},
  updatePermissions: async () => {},
  refresh: async () => {},
  startLiveUpdates: () => () => {},
});

export function FamilyStateProvider({
  familyService,
  children,
}: {
  familyService: FamilyService;
  children: React.ReactNode;
}) {
  const { user } = useAuthContext();
  const { activeJourney } = useJourneyContext();
  const { activeSOS } = useSOSContext();
  const { batteryLevel } = useBatteryContext();
  const { currentLocation } = useLocationTrackingContext();
  const { route } = useRoutingContext();
  const { currentCheckIn } = useCheckInContext();
  const routePath = route?.coordinates ?? null;
  const lastCheckInAt = currentCheckIn?.respondedAt ?? null;
  const nextCheckInAt = activeJourney?.nextCheckInAt ?? null;

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<FamilyInvitation[]>([]);
  const [sentInvitations, setSentInvitations] = useState<FamilyInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track previous journey state to derive ARRIVED status
  const prevJourneyIdRef = useRef<string | null>(null);
  const wasTravellingRef = useRef(false);

  const load = useCallback(async (userId: string, phone: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [memberList, pending, sent] = await Promise.all([
        familyService.getFamilyMembers(userId),
        familyService.getPendingInvitations(phone),
        familyService.getSentInvitations(userId),
      ]);
      setMembers(memberList);
      setPendingInvitations(pending);
      setSentInvitations(sent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load family data.');
    } finally {
      setIsLoading(false);
    }
  }, [familyService]);

  // Load on sign-in / sign-out
  useEffect(() => {
    if (!user?.id) {
      setMembers([]);
      setPendingInvitations([]);
      setSentInvitations([]);
      return;
    }
    load(user.id, user.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Publish status whenever journey/SOS/battery changes
  useEffect(() => {
    if (!user?.id) return;

    const journeyJustCompleted =
      prevJourneyIdRef.current !== null && activeJourney === null;
    const wasTravelling = wasTravellingRef.current;

    prevJourneyIdRef.current = activeJourney?.id ?? null;
    wasTravellingRef.current = activeJourney !== null;

    familyService
      .publishStatus(user.id, {
        activeJourneyId: activeJourney?.id ?? null,
        activeJourneyDestination: activeJourney?.destinationLabel ?? null,
        activeJourneyEta: activeJourney?.initialEta ?? null,
        activeSosId: activeSOS?.id ?? null,
        batteryLevel,
        location: currentLocation,
        routePath,
        lastCheckInAt,
        nextCheckInAt,
      }, wasTravelling, journeyJustCompleted)
      .catch(() => {});
    // Re-publishes on every currentLocation change too — that stream is
    // already throttled by TrackingConfig (10-60s depending on mode), so this
    // doesn't add any new write frequency beyond what location tracking
    // already produces.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Also on a new route and on a check-in being answered or rescheduled —
    // events, not ticks: a guardian should see "I'm OK" when it is said, not
    // at the next location fix.
  }, [
    activeJourney?.id,
    activeSOS?.id,
    batteryLevel,
    currentLocation,
    user?.id,
    routePath,
    lastCheckInAt?.getTime(),
    nextCheckInAt?.getTime(),
  ]);

  // ─── Live status, only while a family screen is open ─────────────────────────
  //
  // One listener per member is cheap while someone is looking and a pointless
  // drain while nobody is, so listeners exist only between a screen's mount
  // and unmount. Keyed on who the members are, not on the member objects:
  // each live update replaces a member object, and resubscribing on that
  // would tear down the listener that just delivered it.
  const [liveViewers, setLiveViewers] = useState(0);
  const startLiveUpdates = useCallback(() => {
    setLiveViewers((n) => n + 1);
    return () => setLiveViewers((n) => n - 1);
  }, []);

  const membersRef = useRef(members);
  membersRef.current = members;
  const memberKey = members.map((m) => `${m.id}:${m.connectionId}`).join('|');
  const isLive = liveViewers > 0;

  useEffect(() => {
    if (!isLive || !memberKey) return;
    return familyService.watchMemberStatuses(membersRef.current, (memberId, status) =>
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, ...status } : m))),
    );
  }, [isLive, memberKey, familyService]);

  const userId = user?.id ?? null;
  const userName = user?.name ?? '';
  const userPhone = user?.phone ?? '';

  const inviteMember = useCallback<FamilyContextValue['inviteMember']>(
    async (toPhone, relationship) => {
      if (!userId) throw new Error('You must be signed in.');
      await familyService.inviteMember(userId, userName, userPhone, toPhone, relationship);
      setSentInvitations(await familyService.getSentInvitations(userId));
    },
    [userId, userName, userPhone, familyService],
  );

  const acceptInvitation = useCallback<FamilyContextValue['acceptInvitation']>(
    async (invitationId) => {
      if (!userId) throw new Error('You must be signed in.');
      const connection = await familyService.acceptInvitation(
        invitationId,
        userId,
        userName,
        userPhone,
      );
      // Refreshes both members and the pending list.
      await load(userId, userPhone);
      return connection;
    },
    [userId, userName, userPhone, familyService, load],
  );

  const declineInvitation = useCallback<FamilyContextValue['declineInvitation']>(
    async (invitationId) => {
      await familyService.declineInvitation(invitationId);
      setPendingInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    },
    [familyService],
  );

  const cancelInvitation = useCallback<FamilyContextValue['cancelInvitation']>(
    async (invitationId) => {
      await familyService.cancelInvitation(invitationId);
      setSentInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    },
    [familyService],
  );

  const removeMember = useCallback<FamilyContextValue['removeMember']>(
    async (connectionId) => {
      if (!userId) throw new Error('You must be signed in.');
      await familyService.removeMember(connectionId, userId);
      setMembers((prev) => prev.filter((m) => m.connectionId !== connectionId));
    },
    [userId, familyService],
  );

  const updatePermissions = useCallback<FamilyContextValue['updatePermissions']>(
    async (connectionId, permissions) => {
      if (!userId) throw new Error('You must be signed in.');
      await familyService.updatePermissions(connectionId, userId, permissions);
      setMembers(await familyService.getFamilyMembers(userId));
    },
    [userId, familyService],
  );

  const refresh = useCallback<FamilyContextValue['refresh']>(async () => {
    if (!userId) return;
    await load(userId, userPhone);
  }, [userId, userPhone, load]);

  const value = useMemo<FamilyContextValue>(
    () => ({
      members,
      pendingInvitations,
      sentInvitations,
      isLoading,
      error,
      inviteMember,
      acceptInvitation,
      declineInvitation,
      cancelInvitation,
      removeMember,
      updatePermissions,
      refresh,
      startLiveUpdates,
    }),
    [
      members,
      pendingInvitations,
      sentInvitations,
      isLoading,
      error,
      inviteMember,
      acceptInvitation,
      declineInvitation,
      cancelInvitation,
      removeMember,
      updatePermissions,
      refresh,
      startLiveUpdates,
    ],
  );


  return (
    <FamilyContext.Provider value={value}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamilyContext(): FamilyContextValue {
  return useContext(FamilyContext);
}
