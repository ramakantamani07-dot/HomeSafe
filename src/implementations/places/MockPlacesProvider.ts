import type { Coordinates } from '../../models/Journey';
import type { Place, PlaceSuggestion } from '../../models/Place';
import {
  formatPostcode,
  haversineMeters,
  isFullPostcode,
  looksLikePostcode,
} from '../../models/Place';
import type { PlacesProvider } from '../../providers/PlacesProvider';

/**
 * Local fixture data — no API key, no network, no billing account.
 *
 * Used in dev mode (see AppProviders) and by tests. The fixtures are the
 * exact places drawn in assets/screens/02, so the search screen can be driven
 * end to end on a real device before a Places key exists: typing "riverside"
 * produces the three schools in the design, and "SE15 4AB" produces the
 * addresses at that postcode.
 */

interface Fixture {
  placeId: string;
  name: string;
  street: string;
  town: string;
  postcode: string;
  coordinates: Coordinates;
  /** Extra strings that should also match this fixture. */
  keywords?: string[];
}

const FIXTURES: Fixture[] = [
  {
    placeId: 'mock-riverside-primary',
    name: 'Riverside Primary School',
    street: 'Mill Lane',
    town: 'London',
    postcode: 'SE15 4AB',
    coordinates: { latitude: 51.4712, longitude: -0.0685 },
    keywords: ['school', 'primary'],
  },
  {
    placeId: 'mock-riverside-secondary',
    name: 'Riverside Secondary School',
    street: 'Park Road',
    town: 'London',
    postcode: 'SE22 8QT',
    coordinates: { latitude: 51.4531, longitude: -0.0702 },
    keywords: ['school', 'secondary'],
  },
  {
    placeId: 'mock-riverside-nursery',
    name: 'Riverside Nursery School',
    street: 'Bank Street',
    town: 'London',
    postcode: 'SE8 2RR',
    coordinates: { latitude: 51.4805, longitude: -0.0261 },
    keywords: ['school', 'nursery'],
  },
  {
    placeId: 'mock-acacia-avenue',
    name: '12 Acacia Avenue',
    street: 'Acacia Avenue',
    town: 'London',
    postcode: 'SE15 3PL',
    coordinates: { latitude: 51.4698, longitude: -0.0712 },
    keywords: ['home'],
  },
  {
    placeId: 'mock-queens-road-station',
    name: "Queen's Road Peckham Station",
    street: "Queen's Road",
    town: 'London',
    postcode: 'SE15 2ND',
    coordinates: { latitude: 51.4735, longitude: -0.0563 },
    keywords: ['station', 'train'],
  },
  {
    placeId: 'mock-peckham-library',
    name: 'Peckham Library',
    street: '122 Peckham Hill Street',
    town: 'London',
    postcode: 'SE15 5JR',
    coordinates: { latitude: 51.4739, longitude: -0.0686 },
    keywords: ['library'],
  },
  {
    placeId: 'mock-kings-college',
    name: "King's College Hospital",
    street: 'Denmark Hill',
    town: 'London',
    postcode: 'SE5 9RS',
    coordinates: { latitude: 51.4683, longitude: -0.0937 },
    keywords: ['hospital', 'a&e'],
  },
  {
    placeId: 'mock-mill-lane-4',
    name: '4 Mill Lane',
    street: 'Mill Lane',
    town: 'London',
    postcode: 'SE15 4AB',
    coordinates: { latitude: 51.4709, longitude: -0.0691 },
  },
  {
    placeId: 'mock-mill-lane-18',
    name: '18 Mill Lane',
    street: 'Mill Lane',
    town: 'London',
    postcode: 'SE15 4AB',
    coordinates: { latitude: 51.4715, longitude: -0.068 },
  },
  {
    placeId: 'mock-mill-lane-27',
    name: '27 Mill Lane',
    street: 'Mill Lane',
    town: 'London',
    postcode: 'SE15 4AB',
    coordinates: { latitude: 51.4718, longitude: -0.0676 },
  },
];

function toPlace(f: Fixture): Place {
  return {
    name: f.name,
    formattedAddress: `${f.street}, ${f.town} ${f.postcode}`,
    postcode: f.postcode,
    coordinates: f.coordinates,
    placeId: f.placeId,
  };
}

function toSuggestion(f: Fixture, near: Coordinates | null): PlaceSuggestion {
  const place = toPlace(f);
  return {
    placeId: f.placeId,
    primaryText: f.name,
    secondaryText: place.formattedAddress,
    distanceMeters: near ? haversineMeters(near, f.coordinates) : null,
    resolved: place,
  };
}

/** Simulates provider latency so debounce/loading states are exercised in dev. */
const LATENCY_MS = 180;

function delay<T>(value: T, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => resolve(value), LATENCY_MS);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      const err = new Error('Aborted');
      err.name = 'AbortError';
      reject(err);
    });
  });
}

export class MockPlacesProvider implements PlacesProvider {
  async searchPlaces(
    query: string,
    near: Coordinates | null,
    signal?: AbortSignal,
  ): Promise<PlaceSuggestion[]> {
    const q = query.trim().toLowerCase();
    if (!q) return delay([], signal);

    // Postcode search: return every address at that postcode, matching the
    // spec's "postcode → list of addresses at that postcode" rule. An
    // outward-only code ("SE15") matches by prefix so results appear while
    // the user is still typing.
    if (looksLikePostcode(query)) {
      const wanted = formatPostcode(query);
      const matches = FIXTURES.filter((f) =>
        isFullPostcode(query)
          ? f.postcode === wanted
          : f.postcode.startsWith(wanted.split(' ')[0]),
      );
      return delay(sortByDistance(matches.map((f) => toSuggestion(f, near))), signal);
    }

    const matches = FIXTURES.filter((f) => {
      const haystack = [f.name, f.street, f.town, f.postcode, ...(f.keywords ?? [])]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    return delay(sortByDistance(matches.map((f) => toSuggestion(f, near))), signal);
  }

  async getPlaceDetails(placeId: string, signal?: AbortSignal): Promise<Place> {
    const fixture = FIXTURES.find((f) => f.placeId === placeId);
    if (!fixture) throw new Error('That place could not be found. Please pick another.');
    return delay(toPlace(fixture), signal);
  }

  async reverseGeocode(coordinates: Coordinates, signal?: AbortSignal): Promise<Place> {
    // Nearest fixture within 400 m gets its real name; otherwise the pin is
    // described by its coordinates rather than inventing a street.
    let nearest: Fixture | null = null;
    let nearestDist = Infinity;
    for (const f of FIXTURES) {
      const d = haversineMeters(coordinates, f.coordinates);
      if (d < nearestDist) {
        nearest = f;
        nearestDist = d;
      }
    }
    if (nearest && nearestDist < 400) {
      return delay({ ...toPlace(nearest), coordinates }, signal);
    }
    return delay(
      {
        name: 'Dropped pin',
        formattedAddress: `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`,
        postcode: null,
        coordinates,
        placeId: null,
      },
      signal,
    );
  }
}

function sortByDistance(suggestions: PlaceSuggestion[]): PlaceSuggestion[] {
  return [...suggestions].sort((a, b) => {
    if (a.distanceMeters === null || b.distanceMeters === null) return 0;
    return a.distanceMeters - b.distanceMeters;
  });
}
