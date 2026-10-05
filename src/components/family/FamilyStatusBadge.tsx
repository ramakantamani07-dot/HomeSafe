import React from 'react';

import type { FamilyStatusType } from '../../models/Family';
import { FAMILY_STATUS_LABELS } from '../../models/Family';
import { StatusBadge, type Severity } from '../ui/StatusBadge';

// Collapses the old 6-unrelated-hues palette (one color per status, all
// equal weight) into the app-wide 3-tier severity system — most statuses
// aren't alerts and shouldn't look like one. Only SOS_ACTIVE is critical.
// See the redesign audit §4/§14.
const SEVERITY: Record<FamilyStatusType, Severity> = {
  HOME: 'safe',
  ARRIVED: 'safe',
  TRAVELLING: 'neutral',
  AT_WORK: 'neutral',
  AT_SCHOOL: 'neutral',
  SHOPPING: 'neutral',
  OFFLINE: 'neutral',
  SOS_ACTIVE: 'critical',
};

interface FamilyStatusBadgeProps {
  status: FamilyStatusType;
}

export function FamilyStatusBadge({ status }: FamilyStatusBadgeProps) {
  return <StatusBadge label={FAMILY_STATUS_LABELS[status]} severity={SEVERITY[status]} />;
}
