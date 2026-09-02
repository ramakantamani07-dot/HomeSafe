import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  deleteField,
  Timestamp,
  query,
  where,
  orderBy,
  limit,
  type Firestore,
} from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';

import type { JourneyProvider, TerminalJourneyStatus } from '../../providers/JourneyProvider';
import { TERMINAL_JOURNEY_STATUSES } from '../../providers/JourneyProvider';
import type { Journey, JourneyStatus, Coordinates, StartJourneyInput } from '../../models/Journey';
import type { LocationUpdate } from '../../models/LocationUpdate';

type StoredJourney = {
  userId: string;
  destinationLabel: string;
  startLocation: Coordinates;
  destinationCoordinates?: Coordinates;
  /** Set by tracking updates — absent on initial creation. */
  currentLocation?: Coordinates;
  lastLocationAt?: Timestamp;
  status: JourneyStatus;
  startedAt: Timestamp;
  endedAt: Timestamp | null;
  createdAt: Timestamp;
  checkInIntervalMinutes: number | null;
  nextCheckInAt: Timestamp | null;
  routeDistanceMeters?: number;
  routeDurationSeconds?: number;
  initialEta?: Timestamp;
};

function journeysCol(db: Firestore, userId: string) {
  return collection(db, 'users', userId, 'journeys');
}

function journeyRef(db: Firestore, userId: string, journeyId: string) {
  return doc(db, 'users', userId, 'journeys', journeyId);
}

function fromFirestore(id: string, data: StoredJourney): Journey {
  return {
    id,
    userId: data.userId,
    destinationLabel: data.destinationLabel,
    startLocation: data.startLocation,
    destinationCoordinates: data.destinationCoordinates ?? null,
    currentLocation: data.currentLocation ?? null,
    status: data.status,
    startedAt: data.startedAt.toDate(),
    endedAt: data.endedAt ? data.endedAt.toDate() : null,
    createdAt: data.createdAt.toDate(),
    checkInIntervalMinutes: data.checkInIntervalMinutes ?? null,
    nextCheckInAt: data.nextCheckInAt ? data.nextCheckInAt.toDate() : null,
    routeDistanceMeters: data.routeDistanceMeters ?? null,
    routeDurationSeconds: data.routeDurationSeconds ?? null,
    initialEta: data.initialEta ? data.initialEta.toDate() : null,
  };
}

export class FirebaseJourneyProvider implements JourneyProvider {
  private readonly db: Firestore;

  constructor(app: FirebaseApp) {
    this.db = getFirestore(app);
  }

  async createJourney(userId: string, input: StartJourneyInput): Promise<Journey> {
    const ref = doc(journeysCol(this.db, userId));
    const startedAt = Timestamp.now();
    const nextCheckInAt = input.checkInIntervalMinutes
      ? Timestamp.fromDate(
          new Date(startedAt.toDate().getTime() + input.checkInIntervalMinutes * 60 * 1000),
        )
      : null;

    const data: StoredJourney = {
      userId,
      destinationLabel: input.destinationLabel,
      startLocation: input.startLocation,
      ...(input.destinationCoordinates ? { destinationCoordinates: input.destinationCoordinates } : {}),
      status: 'ACTIVE',
      startedAt,
      endedAt: null,
      createdAt: startedAt,
      checkInIntervalMinutes: input.checkInIntervalMinutes,
      nextCheckInAt,
      // routeDistanceMeters, routeDurationSeconds, initialEta are omitted on
      // create — Firestore does not accept explicit undefined values. They are
      // set later via saveRouteData() once routing completes.
    };
    await setDoc(ref, data);
    return fromFirestore(ref.id, data);
  }

  async getActiveJourney(userId: string): Promise<Journey | null> {
    const q = query(
      journeysCol(this.db, userId),
      where('status', '==', 'ACTIVE'),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return fromFirestore(d.id, d.data() as StoredJourney);
  }

  async updateJourneyStatus(
    userId: string,
    journeyId: string,
    status: TerminalJourneyStatus,
  ): Promise<Journey> {
    const ref = journeyRef(this.db, userId, journeyId);
    await updateDoc(ref, { status, endedAt: Timestamp.now(), nextCheckInAt: null });
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Journey not found after update.');
    return fromFirestore(snap.id, snap.data() as StoredJourney);
  }

  async saveLocationUpdate(
    userId: string,
    journeyId: string,
    update: LocationUpdate,
  ): Promise<void> {
    const jRef = journeyRef(this.db, userId, journeyId);
    const updatesCol = collection(jRef, 'locationUpdates');
    const batch = writeBatch(this.db);

    batch.update(jRef, {
      currentLocation: { latitude: update.latitude, longitude: update.longitude },
      lastLocationAt: Timestamp.fromDate(update.timestamp),
    });
    batch.set(doc(updatesCol), {
      latitude: update.latitude,
      longitude: update.longitude,
      accuracy: update.accuracy,
      heading: update.heading,
      speed: update.speed,
      timestamp: Timestamp.fromDate(update.timestamp),
    });

    await batch.commit();
  }

  async updateNextCheckInAt(
    userId: string,
    journeyId: string,
    nextCheckInAt: Date | null,
  ): Promise<void> {
    const ref = journeyRef(this.db, userId, journeyId);
    await updateDoc(ref, {
      nextCheckInAt: nextCheckInAt ? Timestamp.fromDate(nextCheckInAt) : null,
    });
  }

  async setJourneySOSStatus(userId: string, journeyId: string): Promise<void> {
    const ref = journeyRef(this.db, userId, journeyId);
    await updateDoc(ref, { status: 'SOS_TRIGGERED', nextCheckInAt: null });
  }

  async saveRouteData(
    userId: string,
    journeyId: string,
    distanceMeters: number,
    durationSeconds: number,
    initialEta: Date,
  ): Promise<void> {
    const ref = journeyRef(this.db, userId, journeyId);
    await updateDoc(ref, {
      routeDistanceMeters: distanceMeters,
      routeDurationSeconds: durationSeconds,
      initialEta: Timestamp.fromDate(initialEta),
    });
  }

  async listJourneyHistory(userId: string): Promise<import('../../models/Journey').Journey[]> {
    const q = query(
      journeysCol(this.db, userId),
      where('status', 'in', TERMINAL_JOURNEY_STATUSES),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => fromFirestore(d.id, d.data() as StoredJourney));
  }

  async deleteJourneyLocationHistory(userId: string, journeyId: string): Promise<void> {
    const jRef = journeyRef(this.db, userId, journeyId);

    // Clear the tracked position from the journey summary document.
    await updateDoc(jRef, {
      currentLocation: deleteField(),
      lastLocationAt: deleteField(),
    }).catch(() => {});

    // Page through locationUpdates sub-collection in batches (Firestore limit: 500 ops/batch).
    const updatesCol = collection(jRef, 'locationUpdates');
    let hasMore = true;
    while (hasMore) {
      const snap = await getDocs(query(updatesCol, limit(200)));
      if (snap.empty) { hasMore = false; break; }
      const batch = writeBatch(this.db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      hasMore = snap.docs.length === 200;
    }
  }
}
