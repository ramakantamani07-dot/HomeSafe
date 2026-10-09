import type { Coordinates } from './Journey';

/**
 * Something a basic-phone member sent by text or missed call (Phase 6.6):
 * an SOS, or a check-in. Written by the server; the app only reads them.
 */
export interface MemberEvent {
  id: string;
  memberId: string;
  kind: 'sos' | 'checkin';
  source: 'sms' | 'call';
  /** For a check-in: "Home", "School" or "OK". */
  label: string | null;
  at: Date;
  /** For an SOS whose lookup succeeded. Never for a check-in. */
  location: Coordinates | null;
  accuracyMeters: number | null;
  /** Why an SOS has no location, when it has none. */
  failure: string | null;
}

/** How an event reads in the member's list. */
export function describeMemberEvent(event: MemberEvent, name: string): { title: string; detail: string } {
  if (event.kind === 'checkin') {
    return {
      title: event.label === 'OK' ? `${name} said they're OK` : `${name} checked in: ${event.label}`,
      detail: 'By text',
    };
  }
  const how = event.source === 'call' ? 'By missed call' : 'By text';
  const where = event.location
    ? 'Approximate area found'
    : event.failure === 'not-requested'
      ? 'They also asked to stop sharing, so no location'
      : 'Location unavailable';
  return { title: `SOS from ${name}`, detail: `${how} · ${where}` };
}
