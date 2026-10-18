/**
 * Screens the app lock never covers.
 *
 * The app lock protects what others share with you — family locations, your
 * history. It must never stand between someone and help: an SOS started from
 * the Lock Screen widget, the Quick Settings tile or (later) Siri opens the
 * app at `/sos-trigger`, and with the lock in front of it nothing was sent
 * until the person passed Face ID. Found 18 Oct 2026; see
 * docs/reference/ACCOUNT_PROTECTION.md ("never gated").
 *
 * - `/sos-trigger`, `/sos`, `/emergency-mode` — the SOS path itself. Ending
 *   an SOS still asks for Face ID (`useSOS().resolveSOSWithAuth`), so an
 *   open emergency screen cannot be used to cancel someone's SOS.
 * - `/fake-incoming-call`, `/fake-active-call` — a lock screen in front of a
 *   fake call gives the pretence away. Neither shows anyone's data.
 *
 * Paths are as `usePathname()` reports them: route groups such as `(app)` are
 * not part of the path.
 */
export const NEVER_LOCKED_PATHS: ReadonlySet<string> = new Set([
  '/sos-trigger',
  '/sos',
  '/emergency-mode',
  '/fake-incoming-call',
  '/fake-active-call',
]);

export function isNeverLocked(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  // "/sos/" and "/sos" are the same screen.
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return NEVER_LOCKED_PATHS.has(path);
}
