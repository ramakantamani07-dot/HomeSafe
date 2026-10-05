import type { FamilyMember } from '../models/Family';

/**
 * "Emma", "Emma & Tom", "Emma, Tom & Alex".
 *
 * JOURNEY_FLOW_SPEC §4 is explicit that guardian names come from the user's
 * real connections and must never be hard-coded — the designs say "Mum &
 * Alex" because that's the mock family, not because those strings belong in
 * the app. This lives in one place so every screen phrases it identically.
 */
export function joinGuardianNames(
  members: FamilyMember[],
  fallback = 'your trusted contacts',
): string {
  const names = members
    .map((m) => m.displayName.split(' ')[0])
    .filter((n) => n.length > 0);

  if (names.length === 0) return fallback;
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/** "2 guardians" / "1 guardian" — used by Home's sharing pill. */
export function guardianCountLabel(count: number): string {
  return `${count} guardian${count === 1 ? '' : 's'}`;
}
