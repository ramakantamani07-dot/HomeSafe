import type { JourneyProvider } from '../providers/JourneyProvider';
import type { LocationProvider } from '../providers/LocationProvider';
import type { NetworkProvider } from '../providers/NetworkProvider';
import type { Coordinates, Journey } from '../models/Journey';
import type { AlertRules } from '../models/AlertRules';
import { DEFAULT_ALERT_RULES } from '../models/AlertRules';
import type { Place, TravelMode } from '../models/Place';
import { DEFAULT_ARRIVAL_RADIUS_METERS } from '../models/Place';
import type { Ride, RideApp, RideBookedWith } from '../models/Ride';
import { confirmInRide, initialRide, normaliseVehicleNumber, rideAfterModeChange } from '../models/Ride';
import type { OfflineSyncService } from './OfflineSyncService';

/**
 * Everything screen 04 collects before "Start journey". Only `destination`
 * is required — the rest carry the spec's defaults, so a caller that just
 * has a place can start a journey without restating them.
 */
export interface StartJourneyOptions {
  destination: Place;
  savedPlaceId?: string | null;
  travelMode?: TravelMode;
  /** The ride app WayLoc is about to open, for a ride (rides AP2). */
  rideApp?: RideApp | null;
  alertRules?: AlertRules;
  arrivalRadiusMeters?: number;
  checkInIntervalMinutes?: number | null;
}
import { JOURNEY_TRACKING_WEB_BASE_URL } from '../config/constants';

const MAX_DESTINATION_LENGTH = 100;

export class JourneyService {
  constructor(
    private readonly journeys: JourneyProvider,
    private readonly location: LocationProvider,
    private readonly offlineSync: OfflineSyncService | null = null,
    private readonly network: NetworkProvider | null = null,
  ) {}

  async startJourney(userId: string, options: StartJourneyOptions): Promise<Journey> {
    const { destination } = options;
    const destinationLabel = destination.name.trim();

    if (!destinationLabel) {
      throw new Error('Please choose a destination before starting.');
    }
    if (destinationLabel.length > MAX_DESTINATION_LENGTH) {
      throw new Error(`Destination must be ${MAX_DESTINATION_LENGTH} characters or less.`);
    }

    const existing = await this.journeys.getActiveJourney(userId);
    if (existing) {
      throw new Error('You already have an active journey. End it before starting a new one.');
    }

    const startLocation = await this.location.getCurrentLocation();
    const destinationCoordinates: Coordinates = { ...destination.coordinates };
    const travelMode = options.travelMode ?? 'walk';

    return this.journeys.createJourney(userId, {
      destinationLabel,
      startLocation,
      checkInIntervalMinutes: options.checkInIntervalMinutes ?? null,
      destinationCoordinates,
      destination,
      savedPlaceId: options.savedPlaceId ?? null,
      travelMode,
      ride: initialRide(travelMode, options.rideApp ?? null),
      alertRules: options.alertRules ?? DEFAULT_ALERT_RULES,
      arrivalRadiusMeters: options.arrivalRadiusMeters ?? DEFAULT_ARRIVAL_RADIUS_METERS,
    });
  }

  async endJourney(userId: string, journeyId: string): Promise<Journey> {
    try {
      return await this.journeys.updateJourneyStatus(userId, journeyId, 'COMPLETED');
    } catch (err) {
      if (await this.isOffline()) {
        await this.offlineSync!.enqueueJourneyStatus(userId, journeyId, 'COMPLETED');
        return this.syntheticJourney(userId, journeyId, 'COMPLETED');
      }
      throw err;
    }
  }

  async cancelJourney(userId: string, journeyId: string): Promise<Journey> {
    try {
      return await this.journeys.updateJourneyStatus(userId, journeyId, 'CANCELLED');
    } catch (err) {
      if (await this.isOffline()) {
        await this.offlineSync!.enqueueJourneyStatus(userId, journeyId, 'CANCELLED');
        return this.syntheticJourney(userId, journeyId, 'CANCELLED');
      }
      throw err;
    }
  }

  async missedCheckIn(userId: string, journeyId: string): Promise<Journey> {
    try {
      return await this.journeys.updateJourneyStatus(userId, journeyId, 'MISSED_CHECKIN');
    } catch (err) {
      if (await this.isOffline()) {
        await this.offlineSync!.enqueueMissedCheckIn(userId, journeyId);
        return this.syntheticJourney(userId, journeyId, 'MISSED_CHECKIN');
      }
      throw err;
    }
  }

  // ── Rides (docs/features/rides.md, Phase 2) ──────────────────────────────
  // Each returns the journey as it now is, so the screen shows what was saved.

  /** "Yes, I'm in". `bookedWith` is the traveller's answer, when they were asked. */
  async confirmInRide(userId: string, journey: Journey, bookedWith: RideBookedWith | null, now = new Date()): Promise<Journey> {
    if (!journey.ride || journey.ride.state !== 'getting_ride') return journey;
    return this.saveTravel(userId, journey, journey.travelMode, confirmInRide(journey.ride, now, bookedWith));
  }

  /**
   * The ride app could not be opened after the journey started: the journey
   * stays in getting_ride, and it no longer claims an app was opened — so
   * "Yes, I'm in" will not ask "Uber or other?" about an app that never came up.
   */
  async clearOpenedApp(userId: string, journey: Journey): Promise<Journey> {
    if (!journey.ride?.openedApp) return journey;
    return this.saveTravel(userId, journey, journey.travelMode, { ...journey.ride, openedApp: null });
  }

  /** Adds, changes or (with an empty string) removes the vehicle number. */
  async setVehicleNumber(userId: string, journey: Journey, input: string): Promise<Journey> {
    if (!journey.ride) return journey;
    return this.saveTravel(userId, journey, journey.travelMode, {
      ...journey.ride,
      vehicleNumber: normaliseVehicleNumber(input),
    });
  }

  /** "Change travel": a new mode without ending the journey. */
  async changeTravelMode(userId: string, journey: Journey, mode: TravelMode): Promise<Journey> {
    if (mode === journey.travelMode) return journey;
    return this.saveTravel(userId, journey, mode, rideAfterModeChange(mode));
  }

  private async saveTravel(userId: string, journey: Journey, travelMode: TravelMode, ride: Ride | null): Promise<Journey> {
    await this.journeys.updateTravel(userId, journey.id, travelMode, ride);
    return { ...journey, travelMode, ride };
  }

  async getActiveJourney(userId: string): Promise<Journey | null> {
    return this.journeys.getActiveJourney(userId);
  }

  /** Finished journeys, newest first — the Journeys tab. */
  async listHistory(userId: string): Promise<Journey[]> {
    return this.journeys.listJourneyHistory(userId);
  }

  async saveRouteData(
    userId: string,
    journeyId: string,
    distanceMeters: number,
    durationSeconds: number,
    initialEta: Date,
  ): Promise<void> {
    await this.journeys.saveRouteData(userId, journeyId, distanceMeters, durationSeconds, initialEta);
  }

  /**
   * Deletes the detailed location trail (locationUpdates sub-collection) for
   * all completed, cancelled, missed, or SOS-triggered journeys.
   * The journey summary documents (destination, dates, status) are kept.
   * Returns the count of journeys processed and any that could not be cleaned.
   */
  async deleteJourneyHistory(
    userId: string,
  ): Promise<{ processed: number; errors: string[] }> {
    const journeys = await this.journeys.listJourneyHistory(userId);
    const errors: string[] = [];

    for (const j of journeys) {
      try {
        await this.journeys.deleteJourneyLocationHistory(userId, j.id);
      } catch {
        errors.push(j.id);
      }
    }

    return { processed: journeys.length - errors.length, errors };
  }

  /**
   * Creates a public, read-only tracking link for a guardian who doesn't
   * have wayLoc installed. Returns the full shareable URL, not just the
   * token — screens should never need to know the web app's base URL.
   * See models/JourneyShare.ts for exactly what the link does and doesn't
   * expose (no live coordinates — status/destination/ETA only).
   */
  async createShareLink(userId: string, journeyId: string, displayName: string): Promise<string> {
    const token = await this.journeys.createShareLink(userId, journeyId, displayName);
    return `${JOURNEY_TRACKING_WEB_BASE_URL}/track/${token}`;
  }

  private async isOffline(): Promise<boolean> {
    if (!this.network || !this.offlineSync) return false;
    return !(await this.network.fetch()).isInternetReachable;
  }

  private syntheticJourney(
    userId: string,
    journeyId: string,
    status: Journey['status'],
  ): Journey {
    const now = new Date();
    return {
      id: journeyId,
      userId,
      destinationLabel: '',
      startLocation: { latitude: 0, longitude: 0 },
      destinationCoordinates: null,
      destination: null,
      savedPlaceId: null,
      travelMode: 'walk',
      ride: null,
      alertRules: DEFAULT_ALERT_RULES,
      arrivalRadiusMeters: DEFAULT_ARRIVAL_RADIUS_METERS,
      currentLocation: null,
      status,
      startedAt: now,
      endedAt: now,
      createdAt: now,
      checkInIntervalMinutes: null,
      nextCheckInAt: null,
      routeDistanceMeters: null,
      routeDurationSeconds: null,
      initialEta: null,
    };
  }
}
