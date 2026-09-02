import { useJourneyContext } from '../context/JourneyContext';

export function useJourney() {
  return useJourneyContext();
}
