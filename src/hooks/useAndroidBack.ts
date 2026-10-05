import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from 'expo-router';

/**
 * Overrides the Android hardware/gesture back button while a screen is
 * focused.
 *
 * JOURNEY_FLOW_SPEC §3 states plainly that "Android system back follows the
 * same rules" as the on-screen back control. That isn't automatic: navigation
 * history reflects how the user got here, which is not always where the spec
 * says back should go — most importantly, back from "On the way" must land on
 * Home with the journey still running, never unwind into the destination
 * picker the journey was started from.
 *
 * Pass a handler that performs the navigation itself; returning true tells
 * Android the event is consumed.
 */
export function useAndroidBack(handler: () => void): void {
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        handler();
        return true;
      });
      return () => subscription.remove();
    }, [handler]),
  );
}
