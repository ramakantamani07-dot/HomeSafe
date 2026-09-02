import { useLocationTrackingContext } from '../context/LocationTrackingContext';

/**
 * Returns the live location and tracking state for the current active journey.
 * Screens must use this hook — never call expo-location directly.
 */
export function useActiveJourneyLocation() {
  return useLocationTrackingContext();
}
