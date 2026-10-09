import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { BasicPhoneMember, NewBasicPhoneMember } from '../models/BasicPhoneMember';
import type { Consent, ResendOutcome } from '../models/Consent';
import type { LocateAudit } from '../models/LocateAudit';
import type { NewSafeZone, SafeZone } from '../models/SafeZone';
import type { MemberEvent } from '../models/MemberEvent';
import type { BasicPhoneMemberProvider } from '../providers/BasicPhoneMemberProvider';
import {
  NetworkLocationError,
  type NetworkLocationFailure,
  type NetworkLocationProvider,
  type NetworkLocationResult,
} from '../providers/NetworkLocationProvider';
import type { Unsubscribe } from '../providers/types';
import { useAuthContext } from './AuthContext';

/** One member's most recent Find, as the find-result screen renders it. */
export type FindState =
  | { status: 'finding' }
  | { status: 'found'; result: NetworkLocationResult }
  | { status: 'failed'; failure: NetworkLocationFailure };

interface BasicPhoneContextValue {
  /** Whether basic-phone finding is offered at all in this build. */
  enabled: boolean;
  members: BasicPhoneMember[];
  finds: Readonly<Record<string, FindState>>;
  addMember(input: NewBasicPhoneMember): Promise<BasicPhoneMember>;
  stopFinding(memberId: string): Promise<void>;
  resendRequest(memberId: string): Promise<ResendOutcome>;
  find(memberId: string): Promise<void>;
  listFinds(memberId: string, limit: number): Promise<LocateAudit[]>;
  subscribeConsent(memberId: string, onChange: (consent: Consent | null) => void): Unsubscribe;
  subscribeZones(memberId: string, onChange: (zones: SafeZone[]) => void): Unsubscribe;
  addZone(zone: NewSafeZone): Promise<void>;
  deleteZone(zoneId: string): Promise<void>;
  subscribeEvents(memberId: string, onChange: (events: MemberEvent[]) => void): Unsubscribe;
}

const noop = () => {};

const BasicPhoneContext = createContext<BasicPhoneContextValue>({
  enabled: false,
  members: [],
  finds: {},
  addMember: async () => {
    throw new Error('BasicPhoneContext not mounted.');
  },
  stopFinding: async () => {},
  resendRequest: async () => 'failed',
  find: async () => {},
  listFinds: async () => [],
  subscribeConsent: () => noop,
  subscribeZones: () => noop,
  addZone: async () => {},
  deleteZone: async () => {},
  subscribeEvents: () => noop,
});

/**
 * Basic-phone members (network-location spec; Option 15 S2–S4, AI13).
 *
 * Owns the live subscription to the member list — so a STOP shows up in the
 * circle the moment the server records it — and the state of each member's
 * latest Find. The decisions (who may be found, how often) are not made here:
 * the server makes them, and the models predict them for the UI.
 */
export function BasicPhoneStateProvider({
  memberProvider,
  locationProvider,
  enabled,
  children,
}: {
  memberProvider: BasicPhoneMemberProvider;
  locationProvider: NetworkLocationProvider;
  enabled: boolean;
  children: React.ReactNode;
}) {
  const { user } = useAuthContext();
  const userId = user?.id ?? null;

  const [members, setMembers] = useState<BasicPhoneMember[]>([]);
  const [finds, setFinds] = useState<Record<string, FindState>>({});

  useEffect(() => {
    setFinds({});
    if (!userId || !enabled) {
      setMembers([]);
      return;
    }
    return memberProvider.subscribeMembers(userId, setMembers);
  }, [userId, enabled, memberProvider]);

  const addMember = useCallback(
    async (input: NewBasicPhoneMember) => {
      if (!userId) throw new Error('Sign in to add someone.');
      return memberProvider.addMember(userId, input);
    },
    [userId, memberProvider],
  );

  const stopFinding = useCallback(
    async (memberId: string) => {
      if (!userId) return;
      await memberProvider.stopFinding(userId, memberId);
      // A result on screen after "stop" would show where someone is after they
      // were promised we would not look. Drop it with the permission.
      setFinds(({ [memberId]: _dropped, ...rest }) => rest);
    },
    [userId, memberProvider],
  );

  const resendRequest = useCallback(
    async (memberId: string): Promise<ResendOutcome> =>
      userId ? memberProvider.resendRequest(userId, memberId) : 'failed',
    [userId, memberProvider],
  );

  const find = useCallback(
    async (memberId: string) => {
      setFinds((prev) => ({ ...prev, [memberId]: { status: 'finding' } }));
      let next: FindState;
      try {
        next = { status: 'found', result: await locationProvider.retrieve(memberId, 'manual') };
      } catch (err) {
        next = {
          status: 'failed',
          failure: err instanceof NetworkLocationError ? err.failure : 'unknown',
        };
      }
      setFinds((prev) => ({ ...prev, [memberId]: next }));
    },
    [locationProvider],
  );

  const listFinds = useCallback(
    async (memberId: string, limit: number) =>
      userId ? memberProvider.listFinds(userId, memberId, limit) : [],
    [userId, memberProvider],
  );

  const subscribeConsent = useCallback(
    (memberId: string, onChange: (consent: Consent | null) => void) =>
      userId ? memberProvider.subscribeConsent(userId, memberId, onChange) : noop,
    [userId, memberProvider],
  );

  const subscribeZones = useCallback(
    (memberId: string, onChange: (zones: SafeZone[]) => void) =>
      userId ? memberProvider.subscribeZones(userId, memberId, onChange) : noop,
    [userId, memberProvider],
  );

  const addZone = useCallback(
    async (zone: NewSafeZone) => {
      if (!userId) throw new Error('Sign in to add a zone.');
      await memberProvider.addZone(userId, zone);
    },
    [userId, memberProvider],
  );

  const deleteZone = useCallback(
    async (zoneId: string) => {
      if (userId) await memberProvider.deleteZone(userId, zoneId);
    },
    [userId, memberProvider],
  );

  const subscribeEvents = useCallback(
    (memberId: string, onChange: (events: MemberEvent[]) => void) =>
      userId ? memberProvider.subscribeEvents(userId, memberId, onChange) : noop,
    [userId, memberProvider],
  );

  const value = useMemo(
    () => ({
      enabled,
      members,
      finds,
      addMember,
      stopFinding,
      resendRequest,
      find,
      listFinds,
      subscribeConsent,
      subscribeZones,
      addZone,
      deleteZone,
      subscribeEvents,
    }),
    [
      enabled,
      members,
      finds,
      addMember,
      stopFinding,
      resendRequest,
      find,
      listFinds,
      subscribeConsent,
      subscribeZones,
      addZone,
      deleteZone,
      subscribeEvents,
    ],
  );

  return <BasicPhoneContext.Provider value={value}>{children}</BasicPhoneContext.Provider>;
}

export function useBasicPhoneContext(): BasicPhoneContextValue {
  return useContext(BasicPhoneContext);
}
