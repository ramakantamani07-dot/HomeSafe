import React, { useCallback } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';

import { useJourney } from '../../hooks/useJourney';
import { useRideHandoff } from '../../hooks/useRideHandoff';
import { useFamily } from '../../hooks/useFamily';
import { seesJourneyDetails } from '../../models/Family';
import { joinGuardianNames } from '../../utils/guardians';
import type { Journey } from '../../models/Journey';
import type { RideApp, RideBookedWith } from '../../models/Ride';
import { RIDE_APP_NAMES, rideDestinationAddress, rideNoun, rideQuestion } from '../../models/Ride';
import { copyText } from '../../utils/clipboard';
import { haptics } from '../../utils/haptics';
import { RideWaitingCard } from './RideWaitingCard';
import { VehicleNumberRow } from './VehicleNumberRow';

interface RidePanelProps {
  journey: Journey;
  /** The screen's clock tick, so "Still waiting?" turns over on time. */
  now: Date;
  onChangeTravel(): void;
}

/**
 * The ride part of "On the way": AP3's "Are you in?" while waiting, AP4's
 * vehicle number once in. Renders nothing for a journey without a ride.
 */
export function RidePanel({ journey, now, onChangeTravel }: RidePanelProps) {
  const { confirmInRide, setVehicleNumber } = useJourney();
  const { openRideApp } = useRideHandoff();
  const { members } = useFamily();
  // Only family who actually see journey details are named (rides AP3 / AP4).
  const watching = seesJourneyDetails(members);
  const watchers = watching.length > 0 ? joinGuardianNames(watching) : null;
  const ride = journey.ride;

  const confirm = useCallback(
    async (bookedWith: RideBookedWith | null) => {
      try {
        await confirmInRide(bookedWith);
        haptics.checkIn();
      } catch {
        Alert.alert("Couldn't save", 'Check your connection and try again. Your journey is still on.');
      }
    },
    [confirmInRide],
  );

  const copyAddress = useCallback(async (address: string) => {
    if (await copyText(address)) {
      AccessibilityInfo.announceForAccessibility('Address copied');
      Alert.alert('Address copied', `Paste it into your ride app:\n${address}`);
    } else {
      Alert.alert("Couldn't copy", address);
    }
  }, []);

  const reopenApp = useCallback(
    async (app: RideApp) => {
      const result = journey.destination ? await openRideApp(app, journey.destination) : 'failed';
      if (result !== 'opened' && result !== 'busy') {
        Alert.alert(`${RIDE_APP_NAMES[app]} didn't open`, 'Your Safe Journey is still on.');
      }
    },
    [journey.destination, openRideApp],
  );

  if (!ride) return null;

  if (ride.state === 'getting_ride') {
    return (
      <RideWaitingCard
        question={rideQuestion(journey.travelMode, journey.startedAt, now)}
        noun={rideNoun(journey.travelMode)}
        watchers={watchers}
        openedApp={ride.openedApp}
        address={rideDestinationAddress(journey.destination)}
        onConfirm={confirm}
        onChangeTravel={onChangeTravel}
        onReopenApp={(app) => void reopenApp(app)}
        onCopyAddress={(a) => void copyAddress(a)}
      />
    );
  }

  return <VehicleNumberRow vehicleNumber={ride.vehicleNumber} watchers={watchers} onSave={setVehicleNumber} />;
}
