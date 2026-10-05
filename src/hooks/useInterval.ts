import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * A `setInterval` that cannot leak and does not run in the background.
 *
 * Replaces the hand-rolled `setInterval` + `clearInterval` pairs that were
 * copy-pasted across five contexts. Two things it fixes beyond tidiness:
 *
 *  - **The callback is held in a ref**, so changing it never restarts the
 *    timer. The hand-rolled version had to choose between a stale closure and
 *    a timer that resets on every render; this needs neither.
 *  - **It pauses when the app is backgrounded** (`pauseInBackground`, on by
 *    default). A 1-second UI ticker that keeps firing in the background wakes
 *    the JS thread for a screen nobody is looking at — pure battery drain. Work
 *    that genuinely must continue while backgrounded belongs in a background
 *    task or a Cloud Function, not a JS interval.
 *
 * Pass `delayMs = null` to pause.
 */
export function useInterval(
  callback: () => void,
  delayMs: number | null,
  options: { pauseInBackground?: boolean } = {},
): void {
  const { pauseInBackground = true } = options;

  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  // Re-reading AppState on every render would be wasteful; this only needs to
  // change when the app actually transitions.
  const isActiveRef = useRef(true);

  useEffect(() => {
    if (!pauseInBackground) return;

    const handleChange = (next: AppStateStatus) => {
      isActiveRef.current = next === 'active';
    };
    const subscription = AppState.addEventListener('change', handleChange);
    isActiveRef.current = AppState.currentState === 'active';

    return () => subscription.remove();
  }, [pauseInBackground]);

  useEffect(() => {
    if (delayMs === null) return;

    const id = setInterval(() => {
      if (pauseInBackground && !isActiveRef.current) return;
      savedCallback.current();
    }, delayMs);

    return () => clearInterval(id);
  }, [delayMs, pauseInBackground]);
}
