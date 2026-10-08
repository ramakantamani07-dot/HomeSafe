import React from 'react';

import { useJourney } from '../../hooks/useJourney';
import { CHECK_IN_INTERVAL_CHOICES } from '../../models/JourneyPreferences';
import { ChoiceRow } from './ChoiceRow';

/**
 * "Check on me if late" — the interval every new journey inherits (`AI9`).
 *
 * Changing this never touches a journey already underway: `AlertRules` are
 * captured when a journey starts precisely so its behaviour can be explained
 * from its own record. Someone mid-walk keeps the rules they set out with.
 */
export function CheckInIntervalRow() {
  const { journeyPreferences, setJourneyPreferences } = useJourney();

  return (
    <ChoiceRow
      icon="time"
      title="Check on me"
      subtitle="How often wayLoc asks if you're OK on a journey"
      choices={CHECK_IN_INTERVAL_CHOICES}
      value={journeyPreferences.checkInIntervalMinutes}
      onChange={(checkInIntervalMinutes) =>
        void setJourneyPreferences({ ...journeyPreferences, checkInIntervalMinutes })
      }
    />
  );
}
