import type {
  ArrivalHandler,
  LocationProvider,
  LocationTrackingOptions,
  LocationUpdateHandler,
} from '../../providers/LocationProvider';
import type { Coordinates } from '../../models/Journey';
import type { LocationUpdate } from '../../models/LocationUpdate';

// Fixed origin: Central London
const MOCK_ORIGIN: Coordinates = {
  latitude: 51.50722,
  longitude: -0.12750,
};

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Simulated time-to-arrival so the arrival-confirmation UI is testable
// without a real device or GPS movement.
const MOCK_ARRIVAL_DELAY_MS = 15_000;

export class MockLocationProvider implements LocationProvider {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private geofenceTimerId: ReturnType<typeof setTimeout> | null = null;
  private mockLat = MOCK_ORIGIN.latitude;
  private mockLng = MOCK_ORIGIN.longitude;

  async getCurrentLocation(): Promise<Coordinates> {
    await delay(600);
    return { latitude: this.mockLat, longitude: this.mockLng };
  }

  async startTracking(
    options: LocationTrackingOptions,
    onUpdate: LocationUpdateHandler,
  ): Promise<void> {
    await this.stopTracking();

    // Emit an immediate first update so the UI shows a location without waiting.
    const firstUpdate: LocationUpdate = {
      latitude: this.mockLat,
      longitude: this.mockLng,
      accuracy: 15,
      heading: null,
      speed: null,
      timestamp: new Date(),
    };
    onUpdate(firstUpdate);

    // Emit subsequent updates with a small drift to simulate movement.
    // Use at least 5 s in dev so tests aren't swamped with updates.
    const interval = Math.max(options.timeInterval, 5_000);
    this.intervalId = setInterval(() => {
      this.mockLat += (Math.random() - 0.5) * 0.0004;
      this.mockLng += (Math.random() - 0.5) * 0.0004;

      const update: LocationUpdate = {
        latitude: this.mockLat,
        longitude: this.mockLng,
        accuracy: 15,
        heading: null,
        speed: null,
        timestamp: new Date(),
      };
      onUpdate(update);
    }, interval);
  }

  async stopTracking(): Promise<void> {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // Reset drift so each new journey starts from the origin.
    this.mockLat = MOCK_ORIGIN.latitude;
    this.mockLng = MOCK_ORIGIN.longitude;
  }

  isTracking(): boolean {
    return this.intervalId !== null;
  }

  isUsingBackgroundMode(): boolean {
    return this.intervalId !== null;
  }

  async hasBackgroundPermission(): Promise<boolean> {
    return true;
  }

  async startGeofencing(
    _destination: Coordinates,
    _radiusMeters: number,
    onArrival: ArrivalHandler,
  ): Promise<void> {
    await this.stopGeofencing();
    // Simulates arrival after a fixed delay so the confirmation UI is
    // testable in dev without real movement.
    this.geofenceTimerId = setTimeout(() => {
      this.geofenceTimerId = null;
      onArrival();
    }, MOCK_ARRIVAL_DELAY_MS);
  }

  async stopGeofencing(): Promise<void> {
    if (this.geofenceTimerId !== null) {
      clearTimeout(this.geofenceTimerId);
      this.geofenceTimerId = null;
    }
  }
}
