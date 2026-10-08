import { useSafePlaceContext } from '../context/SafePlaceContext';

/** Nearby places to head for when uneasy (`AI5`). */
export function useSafePlaces() {
  return useSafePlaceContext();
}
