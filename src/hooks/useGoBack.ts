import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';

/** Where "back" lands when there is nothing behind the current screen. */
const HOME: Href = '/(app)/home';

/**
 * "Back" that always goes somewhere.
 *
 * `router.back()` assumes a screen behind this one. That fails silently when
 * the screen is the first in the stack — opened from a notification, a link,
 * or a development reload — and the user is left on a screen whose back
 * button does nothing ("GO_BACK was not handled"). Screens that leave on
 * their own, like the fake call when it ends, then strand the person on a
 * finished screen. With no history, this goes Home instead.
 */
export function useGoBack(fallback: Href = HOME): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
