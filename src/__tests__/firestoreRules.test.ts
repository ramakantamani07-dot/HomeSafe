/**
 * Firestore security rule tests.
 *
 * These tests require the Firebase Emulator Suite and @firebase/rules-unit-testing.
 * To run:
 *   npm install --save-dev @firebase/rules-unit-testing
 *   firebase emulators:start --only firestore
 *   npx jest --testPathPattern=firestoreRules
 *
 * Without the emulator, the describe blocks below are skipped automatically.
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Emulator availability check ─────────────────────────────────────────────

let rulesTestingAvailable = false;
try {
  require('@firebase/rules-unit-testing');
  rulesTestingAvailable = true;
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
      projectId: 'homesafe-rules-test',
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
});
