import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

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

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<FamilyInvitation[]>([]);
  const [sentInvitations, setSentInvitations] = useState<FamilyInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track previous journey state to derive ARRIVED status
  const prevJourneyIdRef = useRef<string | null>(null);
  const wasTravellingRef = useRef(false);

  const load = async (userId: string, phone: string) => {
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
  };

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
      }, wasTravelling, journeyJustCompleted)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJourney?.id, activeSOS?.id, batteryLevel, user?.id]);

  const value: FamilyContextValue = {
    members,
    pendingInvitations,
    sentInvitations,
    isLoading,
    error,

    inviteMember: async (toPhone, relationship) => {
      if (!user?.id) throw new Error('You must be signed in.');
      await familyService.inviteMember(
        user.id,
        user.name,
        user.phone,
        toPhone,
        relationship,
      );
      // Refresh sent invitations
      const sent = await familyService.getSentInvitations(user.id);
      setSentInvitations(sent);
    },

    acceptInvitation: async (invitationId) => {
      if (!user?.id) throw new Error('You must be signed in.');
      const connection = await familyService.acceptInvitation(
        invitationId,
        user.id,
        user.name,
        user.phone,
      );
      // Refresh both members and pending list
      await load(user.id, user.phone);
      return connection;
    },

    declineInvitation: async (invitationId) => {
      await familyService.declineInvitation(invitationId);
      setPendingInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    },

    cancelInvitation: async (invitationId) => {
      await familyService.cancelInvitation(invitationId);
      setSentInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    },

    removeMember: async (connectionId) => {
      if (!user?.id) throw new Error('You must be signed in.');
      await familyService.removeMember(connectionId, user.id);
      setMembers((prev) => prev.filter((m) => m.connectionId !== connectionId));
    },

    updatePermissions: async (connectionId, permissions) => {
      if (!user?.id) throw new Error('You must be signed in.');
      await familyService.updatePermissions(connectionId, user.id, permissions);
      // Refresh to get latest
      const updated = await familyService.getFamilyMembers(user.id);
      setMembers(updated);
    },

    refresh: async () => {
      if (!user?.id) return;
      await load(user.id, user.phone);
    },
  };

  return (
    <FamilyContext.Provider value={value}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamilyContext(): FamilyContextValue {
  return useContext(FamilyContext);
}
