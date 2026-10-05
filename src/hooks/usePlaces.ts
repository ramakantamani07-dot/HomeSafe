import { usePlacesContext } from '../context/PlacesContext';

/** Address search and the user's saved places. Screens must use this hook. */
export function usePlaces() {
  return usePlacesContext();
}
