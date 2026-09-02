import { useCheckInContext } from '../context/CheckInContext';

export function useCheckIn() {
  return useCheckInContext();
}
