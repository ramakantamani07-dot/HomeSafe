/**
 * Firestore security rule tests.
 *
 * These tests require the Firebase Emulator Suite and @firebase/rules-unit-testing
 * (version-matched to the `firebase` package's major version — see package.json).
 * Run them with:
 *   firebase emulators:exec --project=demo-wayloc --only firestore \
 *     "npx jest --testPathPattern=firestoreRules"
 *
 * `emulators:exec` sets FIRESTORE_EMULATOR_HOST for its child process — that's the
 * gate below, not just "is the package installed". Gating on the package alone
 * would make a plain `npm test` (no emulator running) hard-fail with connection
 * errors instead of skipping, the moment the package is added as a dependency.
 * A bare `firebase emulators:start` (not `exec`) does NOT set this for your shell,
 * so run these via `emulators:exec`, or `export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`
 * yourself first if you're keeping the emulator running across multiple test runs.
 *
 * These tests live in their own Jest project (see jest.config.js) — they need a
 * plain Node environment and different transformIgnorePatterns than the RN/Expo
 * unit suite, because @firebase/rules-unit-testing pulls in firebase/compat files
 * that ship raw ESM syntax the RN transform config doesn't handle.
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Emulator availability check ─────────────────────────────────────────────

let rulesTestingAvailable = false;
try {
  require('@firebase/rules-unit-testing');
  rulesTestingAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
} catch {
  rulesTestingAvailable = false;
}

const describeWithEmulator = rulesTestingAvailable ? describe : describe.skip;

// ─── Rule file ───────────────────────────────────────────────────────────────

const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');
const rulesContent = fs.existsSync(RULES_PATH)
  ? fs.readFileSync(RULES_PATH, 'utf8')
  : '';

// ─── Tests ───────────────────────────────────────────────────────────────────

describeWithEmulator('Firestore security rules', () => {
  // These tests are only executed when @firebase/rules-unit-testing is installed
  // and the Firebase Emulator is running. See instructions above.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testEnv: any;

  beforeAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
    const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    testEnv = await initializeTestEnvironment({
      projectId: 'wayloc-rules-test',
      firestore: {
        rules: rulesContent,
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  // ── 1. Unauthenticated read is denied ───────────────────────────────────────

  test('unauthenticated read of user document is denied', async () => {
    const { assertFails } = require('@firebase/rules-unit-testing');
    const db = testEnv.unauthenticatedContext().firestore() as import('firebase/firestore').Firestore;
    const { doc, getDoc } = require('firebase/firestore');
    await assertFails(getDoc(doc(db, 'users', 'user-a')));
  });

  // ── 2. Cross-user read is denied ────────────────────────────────────────────

  test('user-b cannot read user-a journey', async () => {
    const { assertFails } = require('@firebase/rules-unit-testing');
    const db = testEnv.authenticatedContext('user-b').firestore() as import('firebase/firestore').Firestore;
    const { doc, getDoc } = require('firebase/firestore');
    await assertFails(getDoc(doc(db, 'users', 'user-a', 'journeys', 'journey-1')));
  });

  // ── 3. Authenticated owner can read their own data ──────────────────────────

  test('owner can read their own user document', async () => {
    const { assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, getDoc } = require('firebase/firestore');
    const adminDb = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;
    await assertSucceeds(
      setDoc(doc(adminDb, 'users', 'user-a'), { fcmToken: 'tok' }),
    );
    await assertSucceeds(getDoc(doc(adminDb, 'users', 'user-a')));
  });

  // ── 4. Journey create without userId field is denied ────────────────────────

  test('journey create without userId field is denied', async () => {
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { doc, setDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;
    await assertFails(
      setDoc(doc(db, 'users', 'user-a', 'journeys', 'j1'), {
        status: 'ACTIVE',
        createdAt: new Date(),
        // userId field intentionally omitted → should be denied
      }),
    );
  });

  // ── 5. Journey create with spoofed userId is denied ─────────────────────────

  test('journey create with userId set to another user is denied', async () => {
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { doc, setDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;
    await assertFails(
      setDoc(doc(db, 'users', 'user-a', 'journeys', 'j1'), {
        userId: 'user-b', // spoofed — does not match the authenticated uid
        status: 'ACTIVE',
        createdAt: new Date(),
      }),
    );
  });

  // ── 6. Journey userId cannot be changed after creation ──────────────────────

  test('journey update cannot change the userId field', async () => {
    const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, updateDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;
    await assertSucceeds(
      setDoc(doc(db, 'users', 'user-a', 'journeys', 'j2'), {
        userId: 'user-a',
        status: 'ACTIVE',
        destinationLabel: 'Home',
        createdAt: new Date(),
      }),
    );
    await assertFails(
      updateDoc(doc(db, 'users', 'user-a', 'journeys', 'j2'), {
        userId: 'user-b', // attempting to change ownership
      }),
    );
  });

  // ── 7. Location update is append-only (no update) ───────────────────────────

  test('location update document cannot be edited after creation', async () => {
    const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, collection, addDoc, updateDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;
    // Seed the journey doc
    await assertSucceeds(
      (require('firebase/firestore').setDoc)(
        doc(db, 'users', 'user-a', 'journeys', 'j3'),
        { userId: 'user-a', status: 'ACTIVE', destinationLabel: 'Home', createdAt: new Date() },
      ),
    );
    const colRef = collection(doc(db, 'users', 'user-a', 'journeys', 'j3'), 'locationUpdates');
    const ref = await addDoc(colRef, { latitude: 1, longitude: 2, timestamp: new Date() });
    await assertFails(
      updateDoc(ref, { latitude: 99 }),
    );
  });

  // ── 8. SOS create without status:ACTIVE is denied ───────────────────────────

  test('SOS event cannot be created with status RESOLVED', async () => {
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { doc, setDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;
    await assertFails(
      setDoc(doc(db, 'users', 'user-a', 'sosEvents', 's1'), {
        userId: 'user-a',
        status: 'RESOLVED', // must start as ACTIVE
        createdAt: new Date(),
        triggeredAt: new Date(),
      }),
    );
  });

  // ── 9. SOS triggeredAt cannot be changed after creation ─────────────────────

  test('SOS triggeredAt field is immutable after creation', async () => {
    const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, updateDoc, Timestamp } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;
    const now = Timestamp.now();
    await assertSucceeds(
      setDoc(doc(db, 'users', 'user-a', 'sosEvents', 's2'), {
        userId: 'user-a',
        status: 'ACTIVE',
        createdAt: now,
        triggeredAt: now,
      }),
    );
    await assertFails(
      updateDoc(doc(db, 'users', 'user-a', 'sosEvents', 's2'), {
        triggeredAt: Timestamp.fromDate(new Date(0)), // attempt to backdate
        status: 'RESOLVED',
      }),
    );
  });

  // ── 10. Contact createdAt is immutable after creation ───────────────────────

  test('contact createdAt field cannot be changed after creation', async () => {
    const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, updateDoc, Timestamp } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;
    const now = Timestamp.now();
    await assertSucceeds(
      setDoc(doc(db, 'users', 'user-a', 'contacts', 'c1'), {
        name: 'Alice',
        phone: '+1234567890',
        createdAt: now,
        updatedAt: now,
      }),
    );
    await assertFails(
      updateDoc(doc(db, 'users', 'user-a', 'contacts', 'c1'), {
        createdAt: Timestamp.fromDate(new Date(0)), // attempt to backdate
        name: 'Alice Updated',
      }),
    );
  });

  // ── 11. Cross-user write to contact is denied ────────────────────────────────

  test('user-b cannot write to user-a contacts', async () => {
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, Timestamp } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-b').firestore() as import('firebase/firestore').Firestore;
    await assertFails(
      setDoc(doc(db, 'users', 'user-a', 'contacts', 'c2'), {
        name: 'Attacker',
        createdAt: Timestamp.now(),
      }),
    );
  });

  // ── 12. Device token can be written by the owning user ──────────────────────

  test('owner can write their fcmToken to users/{uid}', async () => {
    const { assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-c').firestore() as import('firebase/firestore').Firestore;
    await assertSucceeds(
      setDoc(doc(db, 'users', 'user-c'), { fcmToken: 'device-token-xyz' }, { merge: true }),
    );
  });

  // ── 13. Own familyStatus is never cross-readable ─────────────────────────────

  test('another user cannot read users/{uid}/familyStatus even with an active connection', async () => {
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, getDoc } = require('firebase/firestore');
    const connId = 'user-d_user-e';
    const adminDb = testEnv.authenticatedContext('user-d').firestore() as import('firebase/firestore').Firestore;
    await setDoc(doc(adminDb, 'familyConnections', connId), {
      user1Id: 'user-d',
      user2Id: 'user-e',
      initiatedBy: 'user-d',
      status: 'ACTIVE',
      createdAt: new Date(),
    });
    await setDoc(doc(adminDb, 'users', 'user-d', 'familyStatus', 'current'), {
      status: 'HOME',
    });
    const otherDb = testEnv.authenticatedContext('user-e').firestore() as import('firebase/firestore').Firestore;
    await assertFails(getDoc(doc(otherDb, 'users', 'user-d', 'familyStatus', 'current')));
  });

  // ── 14. sharedStatus is readable only by connection members ─────────────────

  test('non-member cannot read a sharedStatus doc', async () => {
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, getDoc } = require('firebase/firestore');
    const connId = 'user-f_user-g';
    const publisherDb = testEnv.authenticatedContext('user-f').firestore() as import('firebase/firestore').Firestore;
    await setDoc(doc(publisherDb, 'familyConnections', connId), {
      user1Id: 'user-f',
      user2Id: 'user-g',
      initiatedBy: 'user-f',
      status: 'ACTIVE',
      createdAt: new Date(),
    });
    await setDoc(
      doc(publisherDb, 'familyConnections', connId, 'sharedStatus', 'user-f'),
      { status: 'TRAVELLING', batteryLevel: 0.5 },
    );
    const strangerDb = testEnv.authenticatedContext('stranger').firestore() as import('firebase/firestore').Firestore;
    await assertFails(
      getDoc(doc(strangerDb, 'familyConnections', connId, 'sharedStatus', 'user-f')),
    );
  });

  test('an active connection member can read the other publisher\'s sharedStatus', async () => {
    const { assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, getDoc } = require('firebase/firestore');
    const connId = 'user-h_user-i';
    const publisherDb = testEnv.authenticatedContext('user-h').firestore() as import('firebase/firestore').Firestore;
    await setDoc(doc(publisherDb, 'familyConnections', connId), {
      user1Id: 'user-h',
      user2Id: 'user-i',
      initiatedBy: 'user-h',
      status: 'ACTIVE',
      createdAt: new Date(),
    });
    await setDoc(
      doc(publisherDb, 'familyConnections', connId, 'sharedStatus', 'user-h'),
      { status: 'TRAVELLING', batteryLevel: 0.5 },
    );
    const viewerDb = testEnv.authenticatedContext('user-i').firestore() as import('firebase/firestore').Firestore;
    await assertSucceeds(
      getDoc(doc(viewerDb, 'familyConnections', connId, 'sharedStatus', 'user-h')),
    );
  });

  test('watch presence: only the watcher announces, only about a member, only members read', async () => {
    const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, getDoc, deleteDoc, Timestamp } = require('firebase/firestore');
    const connId = 'user-w1_user-w2';
    const mumDb = testEnv.authenticatedContext('user-w1').firestore() as import('firebase/firestore').Firestore;
    const emmaDb = testEnv.authenticatedContext('user-w2').firestore() as import('firebase/firestore').Firestore;
    const strangerDb = testEnv.authenticatedContext('stranger').firestore() as import('firebase/firestore').Firestore;
    await setDoc(doc(mumDb, 'familyConnections', connId), {
      user1Id: 'user-w1',
      user2Id: 'user-w2',
      initiatedBy: 'user-w1',
      status: 'ACTIVE',
      createdAt: new Date(),
    });
    const until = Timestamp.fromMillis(Date.now() + 120_000);
    const presence = { watcherId: 'user-w1', name: 'Mum', watching: 'user-w2', until };
    const ref = (db: import('firebase/firestore').Firestore, id: string) =>
      doc(db, 'familyConnections', connId, 'watchers', id);

    await assertSucceeds(setDoc(ref(mumDb, 'user-w1'), presence));
    await assertSucceeds(getDoc(ref(emmaDb, 'user-w1')));
    await assertFails(getDoc(ref(strangerDb, 'user-w1')));

    // Nobody announces for someone else, or about someone outside the connection.
    await assertFails(setDoc(ref(emmaDb, 'user-w1'), presence));
    await assertFails(setDoc(ref(mumDb, 'user-w1'), { ...presence, watching: 'stranger' }));
    await assertFails(setDoc(ref(mumDb, 'user-w1'), { ...presence, watching: 'user-w1' }));
    await assertFails(setDoc(ref(mumDb, 'user-w1'), { ...presence, extra: true }));

    // Only the watcher withdraws it.
    await assertFails(deleteDoc(ref(emmaDb, 'user-w1')));
    await assertSucceeds(deleteDoc(ref(mumDb, 'user-w1')));
  });

  test('cannot publish sharedStatus impersonating another connection member', async () => {
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { doc, setDoc } = require('firebase/firestore');
    const connId = 'user-j_user-k';
    const setupDb = testEnv.authenticatedContext('user-j').firestore() as import('firebase/firestore').Firestore;
    await setDoc(doc(setupDb, 'familyConnections', connId), {
      user1Id: 'user-j',
      user2Id: 'user-k',
      initiatedBy: 'user-j',
      status: 'ACTIVE',
      createdAt: new Date(),
    });
    // user-k tries to write a status doc keyed under user-j's id.
    const attackerDb = testEnv.authenticatedContext('user-k').firestore() as import('firebase/firestore').Firestore;
    await assertFails(
      setDoc(doc(attackerDb, 'familyConnections', connId, 'sharedStatus', 'user-j'), {
        status: 'HOME',
      }),
    );
  });

  // ── 15. A connection member cannot rewrite the other side's permissions ─────

  test('user1 cannot overwrite user2Permissions on a connection', async () => {
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, updateDoc } = require('firebase/firestore');
    const connId = 'user-l_user-m';
    const db = testEnv.authenticatedContext('user-l').firestore() as import('firebase/firestore').Firestore;
    await setDoc(doc(db, 'familyConnections', connId), {
      user1Id: 'user-l',
      user2Id: 'user-m',
      initiatedBy: 'user-l',
      status: 'ACTIVE',
      createdAt: new Date(),
      user1Permissions: { sharingMode: 'SHARE_ALWAYS' },
      user2Permissions: { sharingMode: 'SHARE_ALWAYS' },
    });
    await assertFails(
      updateDoc(doc(db, 'familyConnections', connId), {
        user2Permissions: { sharingMode: 'NEVER_SHARE' },
      }),
    );
  });

  // ── 16. Location trail cannot be erased while SOS is active ─────────────────

  test('locationUpdates delete is denied while the journey status is SOS_TRIGGERED', async () => {
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, collection, addDoc, deleteDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-n').firestore() as import('firebase/firestore').Firestore;
    await setDoc(doc(db, 'users', 'user-n', 'journeys', 'j-sos'), {
      userId: 'user-n',
      status: 'SOS_TRIGGERED',
      destinationLabel: 'Home',
      createdAt: new Date(),
    });
    const colRef = collection(doc(db, 'users', 'user-n', 'journeys', 'j-sos'), 'locationUpdates');
    const ref = await addDoc(colRef, { latitude: 1, longitude: 2, timestamp: new Date() });
    await assertFails(deleteDoc(ref));
  });

  test('locationUpdates delete succeeds once the journey is no longer SOS_TRIGGERED', async () => {
    const { assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, collection, addDoc, deleteDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-o').firestore() as import('firebase/firestore').Firestore;
    await setDoc(doc(db, 'users', 'user-o', 'journeys', 'j-done'), {
      userId: 'user-o',
      status: 'COMPLETED',
      destinationLabel: 'Home',
      createdAt: new Date(),
    });
    const colRef = collection(doc(db, 'users', 'user-o', 'journeys', 'j-done'), 'locationUpdates');
    const ref = await addDoc(colRef, { latitude: 1, longitude: 2, timestamp: new Date() });
    await assertSucceeds(deleteDoc(ref));
  });

  // ── 17. nextCheckInAt bounds — closes a client-trust gap in the missed-check-in system ─

  test('nextCheckInAt can be set to a reasonable future value (matches a real check-in interval)', async () => {
    const { assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, updateDoc, Timestamp } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-p').firestore() as import('firebase/firestore').Firestore;
    await setDoc(doc(db, 'users', 'user-p', 'journeys', 'j-checkin'), {
      userId: 'user-p',
      status: 'ACTIVE',
      destinationLabel: 'Home',
      createdAt: new Date(),
    });
    await assertSucceeds(
      updateDoc(doc(db, 'users', 'user-p', 'journeys', 'j-checkin'), {
        nextCheckInAt: Timestamp.fromMillis(Date.now() + 30 * 60_000), // 30 min — a real option
      }),
    );
  });

  test('nextCheckInAt can be cleared to null (missed/cancelled journeys)', async () => {
    const { assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, updateDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-q').firestore() as import('firebase/firestore').Firestore;
    await setDoc(doc(db, 'users', 'user-q', 'journeys', 'j-clear'), {
      userId: 'user-q',
      status: 'ACTIVE',
      destinationLabel: 'Home',
      createdAt: new Date(),
      nextCheckInAt: null,
    });
    await assertSucceeds(
      updateDoc(doc(db, 'users', 'user-q', 'journeys', 'j-clear'), { nextCheckInAt: null }),
    );
  });

  test('nextCheckInAt cannot be set far beyond the longest real interval (suppressing missed-check-in detection)', async () => {
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, updateDoc, Timestamp } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-r').firestore() as import('firebase/firestore').Firestore;
    await setDoc(doc(db, 'users', 'user-r', 'journeys', 'j-abuse'), {
      userId: 'user-r',
      status: 'ACTIVE',
      destinationLabel: 'Home',
      createdAt: new Date(),
    });
    await assertFails(
      updateDoc(doc(db, 'users', 'user-r', 'journeys', 'j-abuse'), {
        // 2 hours — well beyond the 60-min max option + 5-min buffer
        nextCheckInAt: Timestamp.fromMillis(Date.now() + 2 * 60 * 60_000),
      }),
    );
  });

  test('nextCheckInAt cannot be backdated to the past', async () => {
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, updateDoc, Timestamp } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-s').firestore() as import('firebase/firestore').Firestore;
    await setDoc(doc(db, 'users', 'user-s', 'journeys', 'j-backdate'), {
      userId: 'user-s',
      status: 'ACTIVE',
      destinationLabel: 'Home',
      createdAt: new Date(),
    });
    await assertFails(
      updateDoc(doc(db, 'users', 'user-s', 'journeys', 'j-backdate'), {
        nextCheckInAt: Timestamp.fromMillis(Date.now() - 60_000),
      }),
    );
  });

  // ── 18. Journey Shares — public guardian tracking links ─────────────────────

  test('owner can create a journeyShare for their own journey', async () => {
    const { assertSucceeds } = require('@firebase/rules-unit-testing');
    const { collection, addDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-t').firestore() as import('firebase/firestore').Firestore;
    await assertSucceeds(
      addDoc(collection(db, 'journeyShares'), {
        userId: 'user-t',
        journeyId: 'j-share-1',
        displayName: 'Alex',
        createdAt: new Date(),
      }),
    );
  });

  test('cannot create a journeyShare with a spoofed userId', async () => {
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { collection, addDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-u').firestore() as import('firebase/firestore').Firestore;
    await assertFails(
      addDoc(collection(db, 'journeyShares'), {
        userId: 'someone-else',
        journeyId: 'j-share-2',
        displayName: 'Alex',
        createdAt: new Date(),
      }),
    );
  });

  test('owner can read their own journeyShare; another user cannot', async () => {
    const { assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, getDoc } = require('firebase/firestore');
    const ownerDb = testEnv.authenticatedContext('user-v').firestore() as import('firebase/firestore').Firestore;
    await setDoc(doc(ownerDb, 'journeyShares', 'share-v1'), {
      userId: 'user-v',
      journeyId: 'j-share-3',
      displayName: 'Alex',
      createdAt: new Date(),
    });
    await assertSucceeds(getDoc(doc(ownerDb, 'journeyShares', 'share-v1')));

    const strangerDb = testEnv.authenticatedContext('user-w').firestore() as import('firebase/firestore').Firestore;
    await assertFails(getDoc(doc(strangerDb, 'journeyShares', 'share-v1')));
  });

  test('journeyShare cannot be updated once created', async () => {
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, updateDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-x').firestore() as import('firebase/firestore').Firestore;
    await setDoc(doc(db, 'journeyShares', 'share-x1'), {
      userId: 'user-x',
      journeyId: 'j-share-4',
      displayName: 'Alex',
      createdAt: new Date(),
    });
    await assertFails(
      updateDoc(doc(db, 'journeyShares', 'share-x1'), { displayName: 'Someone Else' }),
    );
  });

  test('owner can delete their own journeyShare', async () => {
    const { assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, deleteDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-y').firestore() as import('firebase/firestore').Firestore;
    await setDoc(doc(db, 'journeyShares', 'share-y1'), {
      userId: 'user-y',
      journeyId: 'j-share-5',
      displayName: 'Alex',
      createdAt: new Date(),
    });
    await assertSucceeds(deleteDoc(doc(db, 'journeyShares', 'share-y1')));
  });

  // ── Saved places ────────────────────────────────────────────────────────────

  test('owner can write and read their own saved places', async () => {
    const { assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, getDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;
    await assertSucceeds(
      setDoc(doc(db, 'users', 'user-a', 'savedPlaces', 'p1'), {
        name: 'Home',
        kind: 'home',
        address: null,
        arrivalRadiusMeters: 100,
        createdAt: new Date(),
      }),
    );
    await assertSucceeds(getDoc(doc(db, 'users', 'user-a', 'savedPlaces', 'p1')));
  });

  test('a saved place is never readable by another user', async () => {
    // A saved place is a home address. Guardians see the destination *name*
    // carried on the journey document, never this list.
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { doc, getDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-b').firestore() as import('firebase/firestore').Firestore;
    await assertFails(getDoc(doc(db, 'users', 'user-a', 'savedPlaces', 'p1')));
  });

  // ── Safety checks ───────────────────────────────────────────────────────────

  test('safety check must be created as PENDING with a matching journeyId', async () => {
    const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;
    const base = {
      journeyId: 'j-safety',
      reason: 'stopped',
      raisedAt: new Date(),
      escalateAt: new Date(Date.now() + 120_000),
      respondedAt: null,
      escalatedAt: null,
      location: null,
      batteryPercent: null,
      extendedByMinutes: null,
    };

    // Creating one already ESCALATED would alert guardians with no check ever
    // having been shown to the traveller.
    await assertFails(
      setDoc(doc(db, 'users', 'user-a', 'journeys', 'j-safety', 'safetyChecks', 'sc-bad'), {
        ...base,
        status: 'ESCALATED',
      }),
    );

    await assertSucceeds(
      setDoc(doc(db, 'users', 'user-a', 'journeys', 'j-safety', 'safetyChecks', 'sc1'), {
        ...base,
        status: 'PENDING',
      }),
    );
  });

  test('a pending safety check can be confirmed by its owner', async () => {
    const { assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, updateDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;
    await assertSucceeds(
      updateDoc(doc(db, 'users', 'user-a', 'journeys', 'j-safety', 'safetyChecks', 'sc1'), {
        status: 'CONFIRMED',
        respondedAt: new Date(),
      }),
    );
  });

  test('an escalated safety check can no longer be edited or deleted', async () => {
    // Once guardians have been alerted, the record is a one-way door: a
    // coerced or compromised device must not be able to walk back an alert
    // that has already gone out.
    const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, updateDoc, deleteDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;
    const ref = doc(db, 'users', 'user-a', 'journeys', 'j-safety', 'safetyChecks', 'sc2');

    await assertSucceeds(
      setDoc(ref, {
        journeyId: 'j-safety',
        reason: 'late',
        status: 'PENDING',
        raisedAt: new Date(),
        escalateAt: new Date(Date.now() + 120_000),
        respondedAt: null,
        escalatedAt: null,
        location: null,
        batteryPercent: null,
        extendedByMinutes: null,
      }),
    );

    await assertSucceeds(updateDoc(ref, { status: 'ESCALATED', escalatedAt: new Date() }));

    await assertFails(updateDoc(ref, { status: 'CONFIRMED' }));
    await assertFails(deleteDoc(ref));
  });

  test('a safety check cannot have its reason or raisedAt rewritten', async () => {
    const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, updateDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;
    const ref = doc(db, 'users', 'user-a', 'journeys', 'j-safety', 'safetyChecks', 'sc3');

    await assertSucceeds(
      setDoc(ref, {
        journeyId: 'j-safety',
        reason: 'stopped',
        status: 'PENDING',
        raisedAt: new Date(),
        escalateAt: new Date(Date.now() + 120_000),
        respondedAt: null,
        escalatedAt: null,
        location: null,
        batteryPercent: null,
        extendedByMinutes: null,
      }),
    );

    await assertFails(updateDoc(ref, { reason: 'late' }));
    await assertFails(updateDoc(ref, { raisedAt: new Date(0) }));
  });

  test('the escalation deadline cannot be pushed back by the client', async () => {
    // The coercion case: someone able to extend their own deadline could
    // silence the alert indefinitely while appearing to still be monitored.
    const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, updateDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;
    const ref = doc(db, 'users', 'user-a', 'journeys', 'j-safety', 'safetyChecks', 'sc-deadline');

    await assertSucceeds(
      setDoc(ref, {
        journeyId: 'j-safety',
        reason: 'stopped',
        status: 'PENDING',
        raisedAt: new Date(),
        escalateAt: new Date(Date.now() + 120_000),
        respondedAt: null,
        escalatedAt: null,
        location: null,
        batteryPercent: null,
        extendedByMinutes: null,
      }),
    );

    await assertFails(updateDoc(ref, { escalateAt: new Date(Date.now() + 86_400_000) }));
    // Answering it is still fine — only the deadline is frozen.
    await assertSucceeds(updateDoc(ref, { status: 'CONFIRMED', respondedAt: new Date() }));
  });

  test('walk feedback is readable only by its owner, never by anyone else', async () => {
    // The spec's "do not share it with guardians" made enforceable. A guardian
    // reading this would make every future answer dishonest.
    const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, getDoc } = require('firebase/firestore');
    const owner = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;
    const other = testEnv.authenticatedContext('user-b').firestore() as import('firebase/firestore').Firestore;

    await assertSucceeds(
      setDoc(doc(owner, 'users', 'user-a', 'walkFeedback', 'j-1'), {
        journeyId: 'j-1',
        rating: 'unsafe',
        at: new Date(),
      }),
    );
    await assertSucceeds(getDoc(doc(owner, 'users', 'user-a', 'walkFeedback', 'j-1')));
    await assertFails(getDoc(doc(other, 'users', 'user-a', 'walkFeedback', 'j-1')));
  });

  test('walk feedback rejects a rating outside the three choices', async () => {
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { doc, setDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;
    await assertFails(
      setDoc(doc(db, 'users', 'user-a', 'walkFeedback', 'j-2'), {
        journeyId: 'j-2',
        rating: 'terrified',
        at: new Date(),
      }),
    );
  });

  test('uneasy events are readable only by their owner', async () => {
    // Same promise as walk feedback: a guardian who could read these would
    // change what people are willing to record about feeling unsafe.
    const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, getDoc } = require('firebase/firestore');
    const owner = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;
    const other = testEnv.authenticatedContext('user-b').firestore() as import('firebase/firestore').Firestore;

    await assertSucceeds(
      setDoc(doc(owner, 'users', 'user-a', 'uneasyEvents', 'e-1'), {
        journeyId: 'j-1',
        action: 'told-circle',
        latitude: 51.5,
        longitude: -0.13,
        at: new Date(),
      }),
    );
    await assertSucceeds(getDoc(doc(owner, 'users', 'user-a', 'uneasyEvents', 'e-1')));
    await assertFails(getDoc(doc(other, 'users', 'user-a', 'uneasyEvents', 'e-1')));
  });

  test('uneasy events cannot be edited or deleted, even by their owner', async () => {
    // Append-only: an uneasy moment happened. Letting it be erased would make
    // the log worthless for route safety, and would let someone be pressured
    // into removing it.
    const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, updateDoc, deleteDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;

    await assertSucceeds(
      setDoc(doc(db, 'users', 'user-a', 'uneasyEvents', 'e-2'), {
        journeyId: null,
        action: 'opened',
        latitude: null,
        longitude: null,
        at: new Date(),
      }),
    );
    await assertFails(updateDoc(doc(db, 'users', 'user-a', 'uneasyEvents', 'e-2'), { action: 'dismissed' }));
    await assertFails(deleteDoc(doc(db, 'users', 'user-a', 'uneasyEvents', 'e-2')));
  });

  test('uneasy events reject an action outside the known set', async () => {
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { doc, setDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;
    await assertFails(
      setDoc(doc(db, 'users', 'user-a', 'uneasyEvents', 'e-3'), {
        journeyId: null,
        action: 'panic',
        latitude: null,
        longitude: null,
        at: new Date(),
      }),
    );
  });

  test('a client can never write consent to ACTIVE', async () => {
    // The single most important rule in network location. ACTIVE means "they
    // texted YES *and* their operator authorised it" — neither of which the
    // requesting device is in any position to assert about somebody else.
    const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, updateDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;

    await assertSucceeds(
      setDoc(doc(db, 'users', 'user-a', 'consents', 'm-1'), {
        memberId: 'm-1',
        status: 'PENDING_SMS',
        phoneNumber: '+447700900000',
        requestedAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
      }),
    );

    await assertFails(updateDoc(doc(db, 'users', 'user-a', 'consents', 'm-1'), { status: 'ACTIVE' }));
  });

  test('a client cannot create a consent that is already ACTIVE', async () => {
    // Blocking the update path alone would be pointless if the document could
    // simply be born active.
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { doc, setDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;

    await assertFails(
      setDoc(doc(db, 'users', 'user-a', 'consents', 'm-2'), {
        memberId: 'm-2',
        status: 'ACTIVE',
        phoneNumber: '+447700900001',
        requestedAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
      }),
    );
  });

  test('a client cannot write any intermediate consent state', async () => {
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, updateDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;

    await setDoc(doc(db, 'users', 'user-a', 'consents', 'm-3'), {
      memberId: 'm-3',
      status: 'PENDING_SMS',
      phoneNumber: '+447700900002',
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    for (const status of ['SMS_APPROVED', 'OPERATOR_PENDING', 'DECLINED', 'EXPIRED']) {
      await assertFails(updateDoc(doc(db, 'users', 'user-a', 'consents', 'm-3'), { status }));
    }
  });

  test('revocation always works, and is the one transition a client may make', async () => {
    // STOP must work "any time" and must not depend on a backend being
    // reachable — permission is the thing that should fail closed.
    const { assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, updateDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;

    await setDoc(doc(db, 'users', 'user-a', 'consents', 'm-4'), {
      memberId: 'm-4',
      status: 'PENDING_SMS',
      phoneNumber: '+447700900003',
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    await assertSucceeds(
      updateDoc(doc(db, 'users', 'user-a', 'consents', 'm-4'), { status: 'REVOKED' }),
    );
  });

  test("a client cannot pre-set the server's own consent fields", async () => {
    // The server keeps the rate-limit window and the transparency-SMS throttle
    // on this document. A guardian who could create it with lastNoticeAt far
    // in the future would locate the member without them ever being told.
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { doc, setDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;

    const base = {
      memberId: 'm-8',
      status: 'PENDING_SMS',
      phoneNumber: '+447700900008',
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
    };
    for (const extra of [
      { lastNoticeAt: new Date('2099-01-01') },
      { recentLookupsAt: [] },
      { requestSms: { status: 'sent', at: new Date() } },
      { resendsAt: [] },
    ]) {
      await assertFails(setDoc(doc(db, 'users', 'user-a', 'consents', 'm-8'), { ...base, ...extra }));
    }
  });

  test("the app's own add-someone and stop-finding writes are accepted", async () => {
    // Mirrors FirebaseBasicPhoneMemberProvider field for field. The consent
    // create rule allows only listed keys, so a field added to the app's write
    // and not to the rule would silently break Add someone — this catches it.
    const { assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, writeBatch, serverTimestamp, Timestamp } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;

    const now = Timestamp.now();
    const add = writeBatch(db);
    add.set(doc(db, 'users', 'user-a', 'basicPhoneMembers', 'm-10'), {
      displayName: 'Sam',
      phoneNumber: '+447700900010',
      operator: null,
      consentStatus: 'PENDING_SMS',
      minor: true,
      guardianAttestedAt: now,
      createdAt: now,
    });
    add.set(doc(db, 'users', 'user-a', 'consents', 'm-10'), {
      memberId: 'm-10',
      status: 'PENDING_SMS',
      phoneNumber: '+447700900010',
      requestedAt: now,
      expiresAt: Timestamp.fromMillis(now.toMillis() + 86_400_000),
      activatedAt: null,
      updatedAt: now,
    });
    await assertSucceeds(add.commit());

    const stop = writeBatch(db);
    stop.update(doc(db, 'users', 'user-a', 'consents', 'm-10'), {
      status: 'REVOKED',
      updatedAt: serverTimestamp(),
    });
    stop.update(doc(db, 'users', 'user-a', 'basicPhoneMembers', 'm-10'), { consentStatus: 'REVOKED' });
    await assertSucceeds(stop.commit());
  });

  test('safe zones: only the circle from a client, only for their own member, within bounds', async () => {
    const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, updateDoc, getDoc, Timestamp } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;
    const other = testEnv.authenticatedContext('user-b').firestore() as import('firebase/firestore').Firestore;

    await setDoc(doc(db, 'users', 'user-a', 'basicPhoneMembers', 'm-z'), {
      displayName: 'Sam',
      phoneNumber: '+447700900011',
      consentStatus: 'ACTIVE',
    });
    const zone = {
      memberId: 'm-z',
      name: 'School',
      centre: { latitude: 51.5, longitude: -0.1 },
      radiusMeters: 800,
      createdAt: Timestamp.now(),
    };
    const ref = (d: import('firebase/firestore').Firestore, id: string) => doc(d, 'users', 'user-a', 'safeZones', id);

    await assertSucceeds(setDoc(ref(db, 'z1'), zone));
    // A client cannot fake what the network said, or edit a zone in place.
    await assertFails(setDoc(ref(db, 'z2'), { ...zone, state: 'inside' }));
    await assertFails(updateDoc(ref(db, 'z1'), { radiusMeters: 900 }));
    // Bounds, and only for a member they hold.
    await assertFails(setDoc(ref(db, 'z3'), { ...zone, radiusMeters: 100 }));
    await assertFails(setDoc(ref(db, 'z4'), { ...zone, radiusMeters: 50_000 }));
    await assertFails(setDoc(ref(db, 'z5'), { ...zone, memberId: 'nobody' }));
    // Nobody else reads it; events are server-only.
    await assertFails(getDoc(ref(other, 'z1')));
    await assertFails(setDoc(doc(db, 'users', 'user-a', 'zoneEvents', 'e1'), { event: 'arrived' }));
    // SOS and check-in records are server-written too.
    await assertFails(setDoc(doc(db, 'users', 'user-a', 'memberEvents', 'e1'), { kind: 'sos' }));
  });

  test('a revocation may change nothing but the status', async () => {
    const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, updateDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;

    await setDoc(doc(db, 'users', 'user-a', 'consents', 'm-9'), {
      memberId: 'm-9',
      status: 'PENDING_SMS',
      phoneNumber: '+447700900009',
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    await assertFails(
      updateDoc(doc(db, 'users', 'user-a', 'consents', 'm-9'), { status: 'REVOKED', lastNoticeAt: null }),
    );
    await assertSucceeds(
      updateDoc(doc(db, 'users', 'user-a', 'consents', 'm-9'), { status: 'REVOKED', updatedAt: new Date() }),
    );
  });

  test('a consent record can never be deleted', async () => {
    // Evidence that permission was given or withdrawn. Evidence that can be
    // erased proves nothing.
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, deleteDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;

    await setDoc(doc(db, 'users', 'user-a', 'consents', 'm-5'), {
      memberId: 'm-5',
      status: 'PENDING_SMS',
      phoneNumber: '+447700900004',
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    await assertFails(deleteDoc(doc(db, 'users', 'user-a', 'consents', 'm-5')));
  });

  test('another user cannot read or touch a consent', async () => {
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { doc, getDoc, setDoc } = require('firebase/firestore');
    const owner = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;
    const other = testEnv.authenticatedContext('user-b').firestore() as import('firebase/firestore').Firestore;

    await setDoc(doc(owner, 'users', 'user-a', 'consents', 'm-6'), {
      memberId: 'm-6',
      status: 'PENDING_SMS',
      phoneNumber: '+447700900005',
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    await assertFails(getDoc(doc(other, 'users', 'user-a', 'consents', 'm-6')));
    await assertFails(
      setDoc(doc(other, 'users', 'user-a', 'consents', 'm-7'), {
        memberId: 'm-7',
        status: 'PENDING_SMS',
        phoneNumber: '+447700900006',
        requestedAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
      }),
    );
  });

  test('locate audits are server-written and client-readable only', async () => {
    // A client that could write its own audit entries could also omit them.
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { doc, setDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;

    await assertFails(
      setDoc(doc(db, 'users', 'user-a', 'locateAudits', 'a-1'), {
        memberId: 'm-1',
        requestedBy: 'user-a',
        outcome: 'success',
        at: new Date(),
      }),
    );
  });

  test('consent events are append-only', async () => {
    const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, updateDoc, deleteDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;

    await assertSucceeds(
      setDoc(doc(db, 'users', 'user-a', 'consentEvents', 'e-1'), {
        memberId: 'm-1',
        from: 'PENDING_SMS',
        to: 'REVOKED',
        trigger: 'member-revoked',
        at: new Date(),
      }),
    );
    await assertFails(updateDoc(doc(db, 'users', 'user-a', 'consentEvents', 'e-1'), { to: 'ACTIVE' }));
    await assertFails(deleteDoc(doc(db, 'users', 'user-a', 'consentEvents', 'e-1')));
  });

  test('a client cannot forge a consent event claiming ACTIVE', async () => {
    // The audit trail must not be able to assert something the consent document
    // itself refuses.
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { doc, setDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;

    await assertFails(
      setDoc(doc(db, 'users', 'user-a', 'consentEvents', 'e-2'), {
        memberId: 'm-1',
        from: 'OPERATOR_PENDING',
        to: 'ACTIVE',
        trigger: 'operator-responded',
        at: new Date(),
      }),
    );
  });

  test("a basic-phone member's number cannot be changed under an existing consent", async () => {
    // Consent is granted for a specific number. Changing it would silently
    // transfer permission to whoever holds the new SIM.
    const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
    const { doc, setDoc, updateDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-a').firestore() as import('firebase/firestore').Firestore;

    await assertSucceeds(
      setDoc(doc(db, 'users', 'user-a', 'basicPhoneMembers', 'm-8'), {
        ownerId: 'user-a',
        displayName: 'Sam',
        phoneNumber: '+447700900007',
        consentStatus: 'PENDING_SMS',
        createdAt: new Date(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(db, 'users', 'user-a', 'basicPhoneMembers', 'm-8'), { displayName: 'Sammy' }),
    );
    await assertFails(
      updateDoc(doc(db, 'users', 'user-a', 'basicPhoneMembers', 'm-8'), {
        phoneNumber: '+447700900999',
      }),
    );
  });

  test('another user cannot read or raise a safety check on a journey', async () => {
    const { assertFails } = require('@firebase/rules-unit-testing');
    const { doc, getDoc, setDoc } = require('firebase/firestore');
    const db = testEnv.authenticatedContext('user-b').firestore() as import('firebase/firestore').Firestore;
    const ref = doc(db, 'users', 'user-a', 'journeys', 'j-safety', 'safetyChecks', 'sc1');
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, { journeyId: 'j-safety', status: 'PENDING' }));
  });
});

// ─── Static rule validation (always runs) ────────────────────────────────────

describe('Firestore rule file', () => {
  test('rules file exists and contains expected invariants', () => {
    expect(rulesContent).toBeTruthy();
    expect(rulesContent).toContain("request.auth.uid == userId");
    expect(rulesContent).toContain("incomingHasField('userId', userId)");
    expect(rulesContent).toContain("incomingHasField('status', 'ACTIVE')");
    expect(rulesContent).toContain("fieldUnchanged('triggeredAt')");
    expect(rulesContent).toContain("fieldUnchanged('createdAt')");
    expect(rulesContent).toContain("allow update: if false");
  });

  test('rules version is v2', () => {
    expect(rulesContent).toContain("rules_version = '2'");
  });

  test('rules cover all required collections', () => {
    expect(rulesContent).toContain('match /users/{userId}');
    expect(rulesContent).toContain('match /contacts/{contactId}');
    expect(rulesContent).toContain('match /journeys/{journeyId}');
    expect(rulesContent).toContain('match /locationUpdates/{updateId}');
    expect(rulesContent).toContain('match /checkIns/{checkInId}');
    expect(rulesContent).toContain('match /sosEvents/{sosId}');
    expect(rulesContent).toContain('match /savedPlaces/{savedPlaceId}');
    expect(rulesContent).toContain('match /safetyChecks/{safetyCheckId}');
    expect(rulesContent).toContain('match /walkFeedback/{journeyId}');
  });

  test('walk feedback has no cross-user read grant anywhere', () => {
    const start = rulesContent.indexOf('match /walkFeedback/{journeyId}');
    // Up to the next match block — slicing at the first '}' would stop inside
    // the path placeholder itself.
    const after = rulesContent.indexOf('match /', start + 1);
    const scoped = rulesContent.slice(start, after === -1 ? undefined : after);

    expect(scoped).toContain('isOwner(userId)');
    expect(scoped).not.toContain('hasActiveFamilyConnection');
    expect(scoped).not.toContain('isActiveConnectionMember');
  });

  test('the escalation deadline is immutable once a check is raised', () => {
    const block = rulesContent.slice(rulesContent.indexOf('match /safetyChecks/{safetyCheckId}'));
    expect(block).toContain("fieldUnchanged('escalateAt')");
  });

  test('an escalated safety check is immutable — guardians have already been told', () => {
    const block = rulesContent.slice(rulesContent.indexOf('match /safetyChecks/{safetyCheckId}'));
    expect(block).toContain("resource.data.status != 'ESCALATED'");
  });

  // ── Phase 0 hardening invariants ─────────────────────────────────────────

  test('shared family status is a per-connection subcollection, not a cross-readable global doc', () => {
    expect(rulesContent).toContain('match /sharedStatus/{publisherUserId}');
    expect(rulesContent).toContain('isActiveConnectionMember');
  });

  test('familyStatus under users/{userId} has no cross-user read grant', () => {
    const familyStatusBlock = rulesContent.slice(
      rulesContent.indexOf('match /familyStatus/{doc}'),
    );
    expect(familyStatusBlock).not.toContain('hasActiveFamilyConnection');
  });

  test('each side of a familyConnections doc can only rewrite its own permissions field', () => {
    expect(rulesContent).toContain("request.auth.uid == resource.data.user1Id");
    expect(rulesContent).toContain("request.auth.uid == resource.data.user2Id");
  });

  test('locationUpdates delete is blocked while the journey has an active SOS', () => {
    expect(rulesContent).toContain("!= 'SOS_TRIGGERED'");
  });

  test('contact and journey writes validate field shape', () => {
    expect(rulesContent).toContain('isReasonableString');
  });

  test('nextCheckInAt is bounded server-side, not trusted from the client unchecked', () => {
    expect(rulesContent).toContain('isValidNextCheckIn');
    expect(rulesContent).toContain("duration.value(65, 'm')");
  });

  test('journeyShares are immutable and owner-scoped, not publicly readable from Firestore', () => {
    expect(rulesContent).toContain('match /journeyShares/{shareId}');
    expect(rulesContent).toContain('allow update: if false; // immutable once created');
  });
});
