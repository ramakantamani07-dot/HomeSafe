import { useEffect, useRef } from 'react';

/**
 * A `setTimeout` that is always cleared on unmount and when the delay changes.
 *
 * Same contract as `useInterval`: the callback lives in a ref so changing it
 * never restarts the timer, and `delayMs = null` cancels.
 *
 * Deliberately does **not** pause in the background. A one-shot timeout is
 * usually a deadline — a grace period, an auto-dismiss, a retry — and silently
 * extending a deadline because the user switched apps would be wrong in every
 * case this codebase has. Use `useInterval` for repeating UI tickers, this for
 * deadlines.
 */
export function useTimeout(callback: () => void, delayMs: number | null): void {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (delayMs === null) return;
    const id = setTimeout(() => savedCallback.current(), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);
}
