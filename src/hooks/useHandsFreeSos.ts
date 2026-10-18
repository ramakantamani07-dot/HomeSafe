import { useHandsFreeSosContext } from '../context/HandsFreeSosContext';

/** Hands-free SOS ("Siri, WayLoc help me") for this phone. */
export function useHandsFreeSos() {
  return useHandsFreeSosContext();
}
