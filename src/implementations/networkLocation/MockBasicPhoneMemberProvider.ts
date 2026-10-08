import type { BasicPhoneMember, NewBasicPhoneMember } from '../../models/BasicPhoneMember';
import {
  CONSENT_REQUEST_TTL_MS,
  CONSENT_RESEND_LIMIT,
  CONSENT_RESEND_MIN_INTERVAL_MS,
  type Consent,
  type ConsentStatus,
  type ResendOutcome,
} from '../../models/Consent';
import {
  countsTowardLimit,
  type LocateAudit,
  type LocateOutcome,
  type LocateReason,
} from '../../models/LocateAudit';
import type { NewSafeZone, SafeZone } from '../../models/SafeZone';
import type { BasicPhoneMemberProvider } from '../../providers/BasicPhoneMemberProvider';
import type { Unsubscribe } from '../../providers/types';
import type { MockLocateLedger } from './MockNetworkLocationProvider';

/**
 * How long the mock member takes to "reply YES". Long enough to see the
 * waiting state, short enough not to stall a demo. Null in tests, which drive
 * replies explicitly with `simulateReply`.
 */
export const MOCK_REPLY_DELAY_MS = 6_000;

/**
 * Basic-phone members in memory, standing in for both Firestore and the
 * member's phone.
 *
 * Also the mock's ledger for lookups: `MockNetworkLocationProvider` asks it
 * for consent and recent attempts and records each find here, so in mock mode
 * Find is refused before YES and rate-limited after — the screens are built
 * against the same refusals the server will give, not against a mock that
 * always says yes.
 */
export class MockBasicPhoneMemberProvider implements BasicPhoneMemberProvider, MockLocateLedger {
  private members = new Map<string, BasicPhoneMember>();
  private consents = new Map<string, Consent>();
  private audits: LocateAudit[] = [];
  private resends = new Map<string, Date[]>();
  private zones: SafeZone[] = [];
  private zoneListeners = new Set<() => void>();
  private memberListeners = new Set<() => void>();
  private consentListeners = new Set<() => void>();
  private nextId = 1;

  constructor(private readonly autoReplyMs: number | null = MOCK_REPLY_DELAY_MS) {}

  subscribeMembers(ownerId: string, onChange: (members: BasicPhoneMember[]) => void): Unsubscribe {
    const emit = () =>
      onChange([...this.members.values()].filter((m) => m.ownerId === ownerId));
    this.memberListeners.add(emit);
    emit();
    return () => this.memberListeners.delete(emit);
  }

  async addMember(ownerId: string, input: NewBasicPhoneMember): Promise<BasicPhoneMember> {
    const id = `basic-${this.nextId++}`;
    const now = new Date();
    const member: BasicPhoneMember = {
      id,
      ownerId,
      displayName: input.displayName.trim(),
      phoneNumber: input.phoneNumber,
      operator: null,
      consentStatus: 'PENDING_SMS',
      minor: input.minor,
      guardianAttestedAt: input.minor && input.guardianAttested ? now : null,
      createdAt: now,
    };
    this.members.set(id, member);
    this.consents.set(id, {
      memberId: id,
      status: 'PENDING_SMS',
      phoneNumber: input.phoneNumber,
      requestedAt: now,
      expiresAt: new Date(now.getTime() + CONSENT_REQUEST_TTL_MS),
      activatedAt: null,
      updatedAt: now,
      requestDelivery: 'sent',
    });
    this.notify();

    if (this.autoReplyMs !== null) {
      setTimeout(() => this.simulateReply(id, 'ACTIVE'), this.autoReplyMs);
    }
    return member;
  }

  subscribeConsent(
    _ownerId: string,
    memberId: string,
    onChange: (consent: Consent | null) => void,
  ): Unsubscribe {
    const emit = () => onChange(this.consents.get(memberId) ?? null);
    this.consentListeners.add(emit);
    emit();
    return () => this.consentListeners.delete(emit);
  }

  async stopFinding(_ownerId: string, memberId: string): Promise<void> {
    this.setStatus(memberId, 'REVOKED');
  }

  /** Same limits as the server, so the screen meets the same refusals. */
  async resendRequest(_ownerId: string, memberId: string): Promise<ResendOutcome> {
    const consent = this.consents.get(memberId);
    if (!consent || consent.status !== 'PENDING_SMS') return 'not-pending';
    const previous = this.resends.get(memberId) ?? [];
    if (previous.length >= CONSENT_RESEND_LIMIT) return 'limit-reached';
    const now = new Date();
    const last = previous[previous.length - 1];
    if (last && now.getTime() - last.getTime() < CONSENT_RESEND_MIN_INTERVAL_MS) return 'too-soon';

    this.resends.set(memberId, [...previous, now]);
    this.consents.set(memberId, {
      ...consent,
      expiresAt: new Date(now.getTime() + CONSENT_REQUEST_TTL_MS),
      requestDelivery: 'sent',
    });
    this.notify();
    return 'sent';
  }

  async listFinds(_ownerId: string, memberId: string, limit: number): Promise<LocateAudit[]> {
    // Appended in time order, so reversing is newest-first — and exact even
    // when two finds land in the same millisecond, which sorting by time is not.
    return [...this.audits]
      .reverse()
      .filter((a) => a.memberId === memberId)
      .slice(0, limit);
  }

  /**
   * Test and demo seam: the member's reply, or the operator's answer, arriving.
   * Ignored once the consent is terminal — a late YES cannot undo a STOP.
   */
  simulateReply(memberId: string, status: ConsentStatus): void {
    const current = this.consents.get(memberId)?.status;
    if (!current || current === 'REVOKED' || current === 'DECLINED' || current === 'EXPIRED') return;
    this.setStatus(memberId, status);
  }

  // ── Safe zones ────────────────────────────────────────────────────────────
  // No server runs in mock mode, so zones stay "waiting for the first check" —
  // the honest state for a zone nothing is checking.

  subscribeZones(_ownerId: string, memberId: string, onChange: (zones: SafeZone[]) => void): Unsubscribe {
    const emit = () => onChange(this.zones.filter((z) => z.memberId === memberId));
    this.zoneListeners.add(emit);
    emit();
    return () => this.zoneListeners.delete(emit);
  }

  async addZone(_ownerId: string, zone: NewSafeZone): Promise<void> {
    this.zones.push({
      ...zone,
      id: `zone-${this.zones.length + 1}`,
      state: 'unknown',
      lastCheckedAt: null,
      lastEventAt: null,
      createdAt: new Date(),
    });
    this.zoneListeners.forEach((l) => l());
  }

  async deleteZone(_ownerId: string, zoneId: string): Promise<void> {
    this.zones = this.zones.filter((z) => z.id !== zoneId);
    this.zoneListeners.forEach((l) => l());
  }

  // ── MockLocateLedger ──────────────────────────────────────────────────────

  consentOf(memberId: string): ConsentStatus | null {
    return this.consents.get(memberId)?.status ?? null;
  }

  attemptsOf(memberId: string): Date[] {
    return this.audits
      .filter((a) => a.memberId === memberId && countsTowardLimit(a.outcome))
      .map((a) => a.at);
  }

  record(
    memberId: string,
    reason: LocateReason,
    outcome: LocateOutcome,
    fix: { latitude: number; longitude: number; accuracyMeters: number } | null,
  ): void {
    const member = this.members.get(memberId);
    this.audits.push({
      id: `audit-${this.audits.length + 1}`,
      memberId,
      requestedBy: member?.ownerId ?? '',
      reason,
      outcome,
      location: fix ? { latitude: fix.latitude, longitude: fix.longitude } : null,
      accuracyMeters: fix?.accuracyMeters ?? null,
      at: new Date(),
    });
  }

  private setStatus(memberId: string, status: ConsentStatus): void {
    const consent = this.consents.get(memberId);
    const member = this.members.get(memberId);
    if (!consent || !member) return;
    const now = new Date();
    this.consents.set(memberId, {
      ...consent,
      status,
      updatedAt: now,
      activatedAt: status === 'ACTIVE' ? now : consent.activatedAt,
    });
    this.members.set(memberId, { ...member, consentStatus: status });
    this.notify();
  }

  private notify(): void {
    this.memberListeners.forEach((l) => l());
    this.consentListeners.forEach((l) => l());
  }
}
