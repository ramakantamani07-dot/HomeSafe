import React from 'react';

import { useSafetyPreferences } from '../../context/SafetyPreferencesContext';
import { SOS_HOLD_CHOICES } from '../../models/SafetyPreferences';
import { ChoiceRow } from './ChoiceRow';

/**
 * "SOS hold time" (`AI11`).
 *
 * The subtitle names the consequence rather than the mechanism, because the
 * second tier is derived from this: picking 5 seconds also means 10 to reach
 * emergency services, and someone choosing a longer hold to avoid pocket
 * triggers should know what else it costs them.
 */
export function SosHoldRow() {
  const { preferences, setPreferences } = useSafetyPreferences();
  const seconds = preferences.sosHoldMs / 1_000;

  return (
    <ChoiceRow
      icon="warning"
      title="SOS hold time"
      subtitle={`Hold ${seconds}s to alert your circle, ${seconds * 2}s to also call for help`}
      choices={SOS_HOLD_CHOICES}
      value={preferences.sosHoldMs}
      onChange={(sosHoldMs) => void setPreferences({ ...preferences, sosHoldMs })}
    />
  );
}
