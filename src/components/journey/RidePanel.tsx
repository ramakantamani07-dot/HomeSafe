import React, { useCallback } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';

import { useJourney } from '../../hooks/useJourney';
import type { Journey } from '../../models/Journey';
import type { RideBookedWith } from '../../models/Ride';
import { rideDestinationAddress, rideQuestion } from '../../models/Ride';
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

  if (!ride) return null;

  if (ride.state === 'getting_ride') {
    return (
      <RideWaitingCard
        question={rideQuestion(journey.travelMode, journey.startedAt, now)}
        openedApp={ride.openedApp}
        address={rideDestinationAddress(journey.destination)}
        onConfirm={confirm}
        onChangeTravel={onChangeTravel}
        onCopyAddress={(a) => void copyAddress(a)}
      />
    );
  }

  return <VehicleNumberRow vehicleNumber={ride.vehicleNumber} onSave={setVehicleNumber} />;
}
