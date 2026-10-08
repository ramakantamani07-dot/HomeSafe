import React from 'react';

import { useJourney } from '../../hooks/useJourney';
import {
  LATE_MINUTES_CHOICES,
  STOPPED_MINUTES_CHOICES,
} from '../../models/JourneyPreferences';
import { ChoiceRow } from './ChoiceRow';

/**
 * "If something seems off" — the defaults every new journey inherits (`AI9`).
 *
 * These moved here from the Review screen to satisfy §10: *"nothing on the
 * journey screens asks the user to configure anything."* Review still shows
 * what will happen, which is the difference between informing someone and
 * asking them to make a decision at the moment they are trying to leave.
 *
 * Changing them never affects a journey already running: `AlertRules` are
 * captured at start and immutable after, so a journey's behaviour can always be
 * explained from its own record.
 */
export function AlertRulesRows() {
  const { journeyPreferences, setJourneyPreferences } = useJourney();
  const { alertRules } = journeyPreferences;

  const update = (next: Partial<typeof alertRules>) =>
    void setJourneyPreferences({
      ...journeyPreferences,
      alertRules: { ...alertRules, ...next },
    });

  return (
    <>
      <ChoiceRow
        icon="time"
        title="If I'm late by"
        subtitle="How overdue before wayLoc checks you're OK"
        choices={LATE_MINUTES_CHOICES}
        value={alertRules.lateMinutes}
        onChange={(lateMinutes) => update({ lateMinutes })}
      />
      <ChoiceRow
        icon="location"
        title="If I stop for"
        subtitle="How long stationary before wayLoc checks you're OK"
        choices={STOPPED_MINUTES_CHOICES}
        value={alertRules.stoppedMinutes}
        onChange={(stoppedMinutes) => update({ stoppedMinutes })}
      />
    </>
  );
}
