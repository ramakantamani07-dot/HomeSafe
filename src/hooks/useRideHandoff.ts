import { useRideHandoffContext } from '../context/RideHandoffContext';

/** Ride apps to offer, and opening one with the destination (rides AP1 / AP2). */
export function useRideHandoff() {
  return useRideHandoffContext();
}
