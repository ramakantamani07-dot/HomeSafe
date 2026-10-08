import { useEffect, useState } from 'react';

import { useBasicPhoneContext } from '../context/BasicPhoneContext';
import type { Consent } from '../models/Consent';
import type { LocateAudit } from '../models/LocateAudit';
import type { SafeZone } from '../models/SafeZone';

/** Basic-phone members and their Find state (Option 15 S2–S4, AI13). */
export function useBasicPhoneMembers() {
  return useBasicPhoneContext();
}

/** One member, or undefined once they are gone (deleted, or not yet loaded). */
export function useBasicPhoneMember(memberId: string | undefined) {
  const { members } = useBasicPhoneContext();
  return members.find((m) => m.id === memberId);
}

/** A member's consent record, live — STOP shows the moment it lands. */
export function useMemberConsent(memberId: string | undefined): Consent | null {
  const { subscribeConsent } = useBasicPhoneContext();
  const [consent, setConsent] = useState<Consent | null>(null);

  useEffect(() => {
    if (!memberId) return;
    return subscribeConsent(memberId, setConsent);
  }, [memberId, subscribeConsent]);

  return consent;
}

/** How many past lookups the member screen and find history show. */
export const FIND_HISTORY_LIMIT = 20;

/**
 * A member's recent lookups, newest first. Re-read whenever a Find for them
 * settles, so the list and "Find again in N min" never lag the find just made.
 */
export function useMemberFinds(memberId: string | undefined): LocateAudit[] {
  const { listFinds, finds } = useBasicPhoneContext();
  const [audits, setAudits] = useState<LocateAudit[]>([]);
  const findStatus = memberId ? finds[memberId]?.status : undefined;

  useEffect(() => {
    if (!memberId || findStatus === 'finding') return;
    let cancelled = false;
    listFinds(memberId, FIND_HISTORY_LIMIT)
      .then((list) => {
        if (!cancelled) setAudits(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [memberId, findStatus, listFinds]);

  return audits;
}

/** A member's safe zones, live — state changes as the server checks them. */
export function useMemberZones(memberId: string | undefined): SafeZone[] {
  const { subscribeZones } = useBasicPhoneContext();
  const [zones, setZones] = useState<SafeZone[]>([]);

  useEffect(() => {
    if (!memberId) return;
    return subscribeZones(memberId, setZones);
  }, [memberId, subscribeZones]);

  return zones;
}
