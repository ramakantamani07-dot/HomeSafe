import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  query,
  orderBy,
  Firestore,
} from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';

import type { Place, SavedPlace, SavedPlaceKind } from '../../models/Place';
import { DEFAULT_ARRIVAL_RADIUS_METERS } from '../../models/Place';
import type {
  NewSavedPlace,
  SavedPlaceProvider,
  SavedPlaceUpdates,
} from '../../providers/SavedPlaceProvider';

/**
 * Stored shape. Coordinates are flattened to top-level numbers rather than a
 * nested object so a future Firestore index or geo-query has something to
 * sort on, and `placeId` is kept so the address can be refreshed from the
 * places provider later without re-asking the user.
 */
type StoredSavedPlace = {
  name: string;
  kind: string;
  /** Null when the place is a named slot with no address yet. */
  address: {
    name: string;
    formattedAddress: string;
    postcode: string | null;
    latitude: number;
    longitude: number;
    placeId: string | null;
  } | null;
  arrivalRadiusMeters: number;
  createdAt: Timestamp;
};

function placesCol(db: Firestore, userId: string) {
  return collection(db, 'users', userId, 'savedPlaces');
}

function placeDoc(db: Firestore, userId: string, placeId: string) {
  return doc(db, 'users', userId, 'savedPlaces', placeId);
}

function toStoredAddress(place: Place | null): StoredSavedPlace['address'] {
  if (!place) return null;
  return {
    name: place.name,
    formattedAddress: place.formattedAddress,
    postcode: place.postcode,
    latitude: place.coordinates.latitude,
    longitude: place.coordinates.longitude,
    placeId: place.placeId,
  };
}

function fromStoredAddress(address: StoredSavedPlace['address']): Place | null {
  if (!address) return null;
  return {
    name: address.name,
    formattedAddress: address.formattedAddress,
    postcode: address.postcode,
    coordinates: { latitude: address.latitude, longitude: address.longitude },
    placeId: address.placeId,
  };
}

function fromFirestore(id: string, data: StoredSavedPlace): SavedPlace {
  return {
    id,
    name: data.name,
    kind: data.kind as SavedPlaceKind,
    place: fromStoredAddress(data.address),
    arrivalRadiusMeters: data.arrivalRadiusMeters ?? DEFAULT_ARRIVAL_RADIUS_METERS,
    createdAt: data.createdAt.toDate(),
  };
}

export class FirebaseSavedPlaceProvider implements SavedPlaceProvider {
  private readonly db: Firestore;

  constructor(app: FirebaseApp) {
    this.db = getFirestore(app);
  }

  async listSavedPlaces(userId: string): Promise<SavedPlace[]> {
    const q = query(placesCol(this.db, userId), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => fromFirestore(d.id, d.data() as StoredSavedPlace));
  }

  async addSavedPlace(userId: string, place: NewSavedPlace): Promise<SavedPlace> {
    const data: StoredSavedPlace = {
      name: place.name,
      kind: place.kind,
      address: toStoredAddress(place.place),
      arrivalRadiusMeters: place.arrivalRadiusMeters,
      createdAt: Timestamp.now(),
    };
    const ref = await addDoc(placesCol(this.db, userId), data);
    return fromFirestore(ref.id, data);
  }

  async updateSavedPlace(
    userId: string,
    placeId: string,
    updates: SavedPlaceUpdates,
  ): Promise<SavedPlace> {
    const patch: Record<string, unknown> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.arrivalRadiusMeters !== undefined) {
      patch.arrivalRadiusMeters = updates.arrivalRadiusMeters;
    }
    // `place: null` is a meaningful update (clearing an address), so this
    // checks for the key's presence rather than truthiness.
    if ('place' in updates) patch.address = toStoredAddress(updates.place ?? null);

    const ref = placeDoc(this.db, userId, placeId);
    await updateDoc(ref, patch);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('That place no longer exists.');
    return fromFirestore(snap.id, snap.data() as StoredSavedPlace);
  }

  async deleteSavedPlace(userId: string, placeId: string): Promise<void> {
    await deleteDoc(placeDoc(this.db, userId, placeId));
  }
}
