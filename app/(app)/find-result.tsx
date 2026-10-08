import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { SPACING, type ThemeColors } from '../../src/config/theme';
import {
  useBasicPhoneMember,
  useBasicPhoneMembers,
  useMemberFinds,
} from '../../src/hooks/useBasicPhoneMembers';
import { useGoBack } from '../../src/hooks/useGoBack';
import { useInterval } from '../../src/hooks/useInterval';
import { countsTowardLimit, nextLookupAllowedAt } from '../../src/models/LocateAudit';
import { regionForArea, type MapArea } from '../../src/models/MapModels';
import { AppMapView } from '../../src/components/map/AppMapView';
import { Icon } from '../../src/components/ui/Icon';
import { GlassPill } from '../../src/components/glass';
import { FindResultCard } from '../../src/components/circle/FindResultCard';
import { callNumber, openDirections, textNumber } from '../../src/utils/deviceLinks';

/** How often "Find again in N min" re-reads the clock while it is counting. */
const COUNTDOWN_TICK_MS = 15_000;

/**
 * Find result (Option 15 AI13).
 *
 * The map shows a circle and nothing else — no pin, no avatar at the centre.
 * The board draws an avatar there; for network location the centre is not
 * where the person is, only the middle of where they might be, and a pin on it
 * would be read as a position (spec §5: "a circle … never a dot").
 *
 * This screen starts no lookup itself. Whoever opened it already asked, so
 * returning here from History, or rotating, never spends one of the hour's
 * finds.
 */
export default function FindResultScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();
  const goBack = useGoBack();
  const insets = useSafeAreaInsets();
  const { memberId } = useLocalSearchParams<{ memberId: string }>();

  const member = useBasicPhoneMember(memberId);
  const { finds, find } = useBasicPhoneMembers();
  const audits = useMemberFinds(memberId);
  const state = memberId ? finds[memberId] : undefined;

  const [now, setNow] = useState(() => new Date());
  const nextFindAt = nextLookupAllowedAt(
    audits.filter((a) => countsTowardLimit(a.outcome)).map((a) => a.at),
    now,
  );
  // Ticks only while there is a countdown to show; paused in the background.
  useInterval(() => setNow(new Date()), nextFindAt ? COUNTDOWN_TICK_MS : null);

  const lastFound = audits.find((a) => a.outcome === 'success' && a.location !== null);

  // This find's area; failing that, the last known one — but only when the
  // phone could not be reached (spec's "phone off, with last known location").
  // After a STOP or before a YES, showing an old location would be exactly the
  // thing the member refused.
  let area: MapArea | null = null;
  let seenAt: Date | null = null;
  if (state?.status === 'found') {
    area = {
      id: 'find',
      centre: state.result.location,
      radiusMeters: state.result.accuracyMeters ?? 0,
    };
    seenAt = state.result.observedAt;
  } else if (
    lastFound?.location &&
    (state === undefined || (state.status === 'failed' && state.failure === 'device-unreachable'))
  ) {
    area = { id: 'last', centre: lastFound.location, radiusMeters: lastFound.accuracyMeters ?? 0 };
    seenAt = lastFound.at;
  }

  if (!member) return null;

  return (
    <View style={styles.screen}>
      {area ? (
        <AppMapView region={regionForArea(area)} markers={[]} polyline={null} areas={[area]} />
      ) : (
        <View style={styles.noMap} />
      )}

      <GlassPill
        style={[styles.back, { top: insets.top + SPACING.sm }]}
        onPress={() => goBack()}
        accessibilityLabel="Back"
      >
        <Icon name="chevronLeft" size={22} color={theme.textPrimary} />
      </GlassPill>

      <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
        <FindResultCard
          name={member.displayName}
          state={state}
          area={area}
          seenAt={seenAt}
          nextFindAt={nextFindAt}
          now={now}
          onCall={() => callNumber(member.phoneNumber)}
          onText={() => textNumber(member.phoneNumber)}
          onDirections={() =>
            area && openDirections(area.centre.latitude, area.centre.longitude, member.displayName)
          }
          onFindAgain={() => find(member.id)}
          onHistory={() => router.push({ pathname: '/basic-member', params: { memberId: member.id } })}
        />
      </View>
    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    noMap: { flex: 1, backgroundColor: theme.background },
    back: { position: 'absolute', left: SPACING.lg, minWidth: 44, minHeight: 44 },
    sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: theme.surface },
  });
}
