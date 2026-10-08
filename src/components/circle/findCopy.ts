import type { NetworkLocationFailure } from '../../providers/NetworkLocationProvider';

/**
 * What the find-result screen says when a Find does not return a location.
 *
 * Each failure means something different for the guardian to do — wait, try
 * later, call instead — so each gets its own words. None of them guesses: a
 * phone the network cannot reach is "off or out of signal", never "safe" or
 * "at home", and an unknown failure says we could not ask rather than implying
 * an answer came back.
 */
export function describeFindFailure(
  failure: NetworkLocationFailure,
  name: string,
): { title: string; body: string } {
  switch (failure) {
    case 'no-consent':
      return {
        title: `${name} isn't sharing`,
        body: `${name} can be found only after they reply YES, and not after they text STOP.`,
      };
    case 'rate-limited':
      return {
        title: 'Too soon to look again',
        body: `Finds are limited so that being findable never becomes being tracked. ${name} is texted each time.`,
      };
    case 'device-unreachable':
      return {
        title: `Can't reach ${name}'s phone`,
        body: 'It may be switched off or out of signal. Their network has no newer location than the last one below.',
      };
    case 'operator-unsupported':
      return {
        title: `${name}'s network can't do this yet`,
        body: 'Their mobile network does not support finding by network. Calling them still works.',
      };
    case 'roaming':
      return {
        title: `${name} is roaming`,
        body: 'Their network cannot locate a phone while it is abroad.',
      };
    case 'not-guardian':
      return {
        title: "You can't find this person",
        body: 'Only the person who asked them can look them up.',
      };
    case 'operator-unavailable':
    case 'timeout':
    case 'unknown':
    default:
      return {
        title: "Couldn't ask the network",
        body: 'Nothing came back this time. Try again in a moment, or call them.',
      };
  }
}

/** "Find again in 8 min" — whole minutes, rounded up, never "0 min". */
export function minutesUntil(at: Date, now: Date): number {
  return Math.max(1, Math.ceil((at.getTime() - now.getTime()) / 60_000));
}

/** "within 800 m" / "within 1.2 km", matching how the boards write a radius. */
export function describeRadius(meters: number): string {
  return meters < 1_000 ? `within ${Math.round(meters / 50) * 50} m` : `within ${(meters / 1_000).toFixed(1)} km`;
}

/** "Today 08:42", "Yesterday 21:10", "30 Sep 21:10" — how the boards date a find. */
export function formatFindTime(at: Date, now: Date): string {
  const time = at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1_000;
  if (at.getTime() >= startOfToday) return `Today ${time}`;
  if (at.getTime() >= startOfToday - dayMs) return `Yesterday ${time}`;
  return `${at.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${time}`;
}
