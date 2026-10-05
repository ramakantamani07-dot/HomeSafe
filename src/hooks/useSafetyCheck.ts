import { useSafetyCheckContext } from '../context/SafetyCheckContext';

/** The automatic "are you OK?" state behind screen 08. */
export function useSafetyCheck() {
  return useSafetyCheckContext();
}
