import type { AskOkOutcome, FamilyMember } from '../../models/Family';

/**
 * How an app member's status reads in a list — Home's circle and Family.
 *
 * Only states we can stand behind (Option 15 §1 principle 4). A member whose
 * status we have no recent basis for reads as "Not sharing", and someone not
 * on a journey is exactly that — never "safe" and never "at home".
 */
export function describeMemberStatus(member: FamilyMember): string {
  switch (member.status) {
    case 'AT_WORK':
      return 'At work';
    case 'AT_SCHOOL':
      return 'At school';
    case 'TRAVELLING':
      return member.activeJourneyDestination
        ? `On the way to ${member.activeJourneyDestination}`
        : 'On the way';
    case 'ARRIVED':
      return 'Arrived';
    case 'SOS_ACTIVE':
      return 'SOS — needs help';
    case 'IDLE':
    case 'HOME':
      return 'Not on a journey';
    case 'OFFLINE':
    default:
      return 'Not sharing';
  }
}

/** "just now", "2 min ago", "1 h ago" — when their status was last updated. */
export function describeAge(at: Date | null, now: Date): string | null {
  if (!at) return null;
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}

/** What Watch live says after Ask "OK?" — never "asked" when nothing reached them. */
export function describeAskOkOutcome(
  outcome: AskOkOutcome,
  name: string,
): { title: string; body: string } | null {
  switch (outcome) {
    case 'sent':
      return null;
    case 'no-device':
      return {
        title: `Couldn't reach ${name}`,
        body: `${name}'s phone isn't set up for wayLoc notifications, so nothing was sent. Try calling instead.`,
      };
    case 'too-soon':
      return { title: 'Asked recently', body: `You can ask ${name} again in a few minutes.` };
    case 'not-travelling':
      return { title: `${name} isn't on a journey`, body: 'Ask "OK?" is for while someone is on their way.' };
    case 'failed':
    default:
      return { title: "Couldn't ask", body: 'Check your connection and try again, or call them.' };
  }
}
