import { RoutingService } from '../services/RoutingService';
import { SafetyCheckService } from '../services/SafetyCheckService';
import type { RoutingProvider, RouteRequestOptions } from '../providers/RoutingProvider';
import type { RouteResult } from '../models/RouteResult';
import type { Coordinates } from '../models/Journey';
import { DEFAULT_ALERT_RULES } from '../models/AlertRules';
import { TRAVEL_MODES } from '../models/Place';
import { TRACKING_CONFIGS, getTrackingConfig } from '../models/TrackingConfig';
import {
  PICKUP_ALLOWANCE_MINUTES,
  VEHICLE_STOPPED_MINUTES,
  alertRulesFor,
  expectedArrival,
  isRide,
  offRouteThresholdMeters,
  rideDurationLabel,
  routingProfile,
  trackingMotion,
} from '../models/TravelModeProfile';

const FROM = { latitude: 52.24, longitude: -0.9 };
const TO = { latitude: 52.25, longitude: -0.88 };

/** Returns a 1.8 km route whose time depends on the profile asked for, like MapKit. */
class ProfileRouter implements RoutingProvider {
  asked: Array<RouteRequestOptions['profile']> = [];
  constructor(readonly profilesSupported: readonly ('walking' | 'driving')[]) {}
  async getRoute(from: Coordinates, to: Coordinates, _s?: AbortSignal, options: RouteRequestOptions = {}): Promise<RouteResult> {
    this.asked.push(options.profile);
    const served = this.profilesSupported.includes(options.profile ?? 'driving') ? options.profile : 'driving';
    return {
      providerRouteId: null,
      coordinates: [from, to],
      distanceMeters: 1800,
      durationSeconds: served === 'walking' ? 1400 : 300,
      steps: [],
      calculatedAt: new Date(0),
    };
  }
}

describe('travel modes', () => {
  it('offers the seven AP1 modes in order', () => {
    expect(TRAVEL_MODES.map((m) => m.label)).toEqual(['Walk', 'Bus', 'Bike', 'Car', 'Cab', 'Auto', 'Bike taxi']);
    expect(TRAVEL_MODES.filter((m) => isRide(m.mode)).map((m) => m.mode)).toEqual(['cab', 'auto', 'bikeTaxi']);
  });

  it('walks on walking routes and everything on wheels on roads', () => {
    expect(routingProfile('walk')).toBe('walking');
    for (const mode of ['bus', 'bike', 'car', 'cab', 'auto', 'bikeTaxi'] as const) {
      expect(routingProfile(mode)).toBe('driving');
    }
  });
});

describe('route times per mode', () => {
  it('Car uses a driving time — the bug where it showed a walking ETA stays fixed', async () => {
    const router = new ProfileRouter(['walking', 'driving']);
    const service = new RoutingService(router);
    expect((await service.previewRoute(FROM, TO, 'car')).durationSeconds).toBe(300);
    expect((await service.previewRoute(FROM, TO, 'auto')).durationSeconds).toBe(300);
    expect((await service.previewRoute(FROM, TO, 'walk')).durationSeconds).toBe(1400);
    expect(router.asked).toEqual(['driving', 'driving', 'walking']);
  });

  it('derives a walking time when the router only drives (the OSRM demo)', async () => {
    const service = new RoutingService(new ProfileRouter(['driving']));
    expect((await service.previewRoute(FROM, TO, 'walk')).durationSeconds).toBe(Math.round(1800 / 1.35));
  });

  it('estimates bike and bus from distance, since no router knows them', async () => {
    const service = new RoutingService(new ProfileRouter(['walking', 'driving']));
    expect((await service.previewRoute(FROM, TO, 'bike')).durationSeconds).toBe(Math.round(1800 / 4.2));
    expect((await service.previewRoute(FROM, TO, 'bus')).durationSeconds).toBe(Math.round(1800 / 5));
  });
});

describe('pickup allowance', () => {
  const start = new Date('2026-10-19T21:44:00Z');

  it('a ride starting now arrives after the allowance plus the drive (AP1)', () => {
    expect(expectedArrival('auto', 14 * 60, start, start)).toEqual(new Date('2026-10-19T22:08:00Z'));
    expect(rideDurationLabel('auto', 14 * 60)).toBe(`~${PICKUP_ALLOWANCE_MINUTES} min pickup + 14 min drive`);
  });

  it('once the allowance has passed, the drive counts from now — a ride that never came still goes late', () => {
    const later = new Date('2026-10-19T22:00:00Z');
    expect(expectedArrival('auto', 14 * 60, later, start)).toEqual(new Date('2026-10-19T22:14:00Z'));
  });

  it('nothing changes for a walk or your own car', () => {
    expect(expectedArrival('walk', 600, start, start)).toEqual(new Date('2026-10-19T21:54:00Z'));
    expect(expectedArrival('car', 600, start, start)).toEqual(new Date('2026-10-19T21:54:00Z'));
    expect(rideDurationLabel('car', 600)).toBeNull();
  });
});

describe('safety checks per mode', () => {
  it('vehicles wait longer before "stopped"; walks keep the person\'s own setting', () => {
    expect(alertRulesFor('walk', DEFAULT_ALERT_RULES)).toEqual(DEFAULT_ALERT_RULES);
    expect(alertRulesFor('auto', DEFAULT_ALERT_RULES).stoppedMinutes).toBe(VEHICLE_STOPPED_MINUTES);
    // Never less patient than the person asked for.
    expect(alertRulesFor('cab', { ...DEFAULT_ALERT_RULES, stoppedMinutes: 30 }).stoppedMinutes).toBe(30);
  });

  it('a different main road is not "off route" in a vehicle, but is on foot', () => {
    const service = new SafetyCheckService({} as never);
    const base = { samples: [], eta: null, rules: DEFAULT_ALERT_RULES, now: new Date(), offRouteMeters: 450 };
    expect(service.detect({ ...base, offRouteThresholdMeters: offRouteThresholdMeters('walk') })).toBe('off-route');
    expect(service.detect({ ...base, offRouteThresholdMeters: offRouteThresholdMeters('auto') })).toBeNull();
  });
});

describe('tracking per mode', () => {
  it('reports less often in a vehicle on a journey, and never changes SOS', () => {
    expect(trackingMotion('auto')).toBe('vehicle');
    expect(trackingMotion('walk')).toBe('pedestrian');
    const walk = getTrackingConfig('JOURNEY', 1, 'MOVING', 'pedestrian');
    const ride = getTrackingConfig('JOURNEY', 1, 'MOVING', 'vehicle');
    expect(walk).toEqual(TRACKING_CONFIGS.JOURNEY);
    expect(ride.distanceInterval).toBe(TRACKING_CONFIGS.JOURNEY.distanceInterval * 4);
    expect(ride.timeInterval).toBe(TRACKING_CONFIGS.JOURNEY.timeInterval * 2);
    expect(getTrackingConfig('SOS', 1, 'MOVING', 'vehicle')).toEqual(TRACKING_CONFIGS.SOS);
  });
});
