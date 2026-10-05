# wayLoc Security Review

Last updated: 2026-09-01

---

## 1. Authentication boundary

**Provider:** Firebase Authentication (Phone OTP via `PhoneAuthProvider`).

**Session persistence:** Auth tokens are stored in `expo-secure-store` (hardware-backed
on iOS/Android) via `getReactNativePersistence`. On web (development only), the Firebase
default persistence is used — web builds are not production targets.

**User identity in code:** `userId` is always derived from the active Firebase Auth
session (`auth.currentUser.uid` or the value carried by the auth-state listener). No screen
or hook passes a `userId` from UI state. The `AccountDeletionService`, `JourneyService`,
and all other services accept `userId` as a parameter that callers obtain from
`useAuthContext().user.id` — which is set by the auth-state listener, not user input.

**OTP error mapping:** Firebase error codes are mapped to human-readable messages in
`FirebaseAuthProvider`. Sensitive codes (e.g. `auth/requires-recent-login`) are surfaced
to the UI as actionable guidance rather than raw Firebase strings.

---

## 2. Firestore security rules

Rules are in `firestore.rules` at the project root. Deploy with `firebase deploy --only firestore:rules`.

**Key invariants:**

| Rule | Why |
|---|---|
| `request.auth.uid == userId` (path variable) | Every document is owned by exactly one authenticated user. |
| Journey `create` requires `incomingHasField('userId', userId)` | Prevents a user from writing a `userId` that doesn't match their own auth UID. |
| SOS `create` requires `incomingHasField('status', 'ACTIVE')` | Prevents creating pre-resolved or forged SOS events. |
| Journey `update` checks `fieldUnchanged('userId') && fieldUnchanged('createdAt')` | Ownership and creation timestamp are immutable after creation. |
| Location update `update: if false` | GPS records are append-only; no edit is ever issued by the app. |
| All unauthenticated access denied | Firestore's default-deny plus explicit `if false` for sensitive mutations. |

**Testing:** Run rule tests with the Firebase Emulator:
```bash
firebase emulators:start --only firestore
npx jest --testPathPattern=firestoreRules
```

---

## 3. Local data storage

| Data | Storage | Rationale |
|---|---|---|
| Firebase Auth session token | `expo-secure-store` | Hardware-backed keychain on native. Firebase manages the key names via `getReactNativePersistence`. |
| User profile (name, phone, settings) | `expo-secure-store` | Sensitive PII; SecureStore prevents extraction by other apps. |
| Offline operation queue | `AsyncStorage` | Non-sensitive operational metadata (journey IDs, timestamps). Acceptable risk. |
| Fake call settings (name, delay) | `AsyncStorage` | Non-sensitive preference data. No PII. |
| Privacy preferences (biometric lock on/off) | `expo-secure-store` | Stored via `SecurePrivacyStore`; controls biometric gate. |

**No sensitive data in `AsyncStorage`:** Phone numbers, auth tokens, and location
coordinates are never written to AsyncStorage. The offline queue stores IDs and
timestamps only; no raw GPS coordinates are queued (location updates are best-effort).

---

## 4. Location data handling

- GPS is only collected during an **active journey** or an **active SOS**.
- Background location uses `expo-task-manager` with a graceful fallback to foreground
  `watchPositionAsync` when the background-task module is not available.
- `currentLocation` on the journey document is the most-recently-known position; it is
  cleared when the user deletes their journey location history.
- Location updates are never queued offline (priority 5, evicted under backpressure).
- No location data is sent to third-party services. Routing uses the OSRM open-source
  server; coordinates sent for routing are not logged by wayLoc.

---

## 5. Sensitive console logging

- No `console.log` of phone numbers, auth tokens, GPS coordinates, or user IDs was found
  in production paths at the time of this review.
- `__DEV__` guards in `LowBatteryBanner` limit diagnostic output to development builds.
- **Implemented:** `babel-plugin-transform-remove-console` is wired into `babel.config.js`,
  gated on `NODE_ENV === 'production'` (keeps `console.error`/`console.warn`). Closes this
  structurally rather than by audit — a future debug `console.log` left in won't ship to
  device logs in production builds.

---

## 6. Data retention and account deletion

See `DATA_RETENTION.md` for full retention periods and cleanup processes.

**Account deletion sequence (enforced by `AccountDeletionService`):**

1. Remove device FCM token (push notifications stop immediately).
2. Delete all journey sub-collections (`locationUpdates`, `checkIns`) before journey documents.
3. Delete all contacts, SOS events, and the user root document.
4. Clear local offline queue (`AsyncStorage`) and user profile (`SecureStore`).
5. **Delete Firebase Auth account last** — auth token is required for Firestore steps 1–4.

If step 5 fails with `auth/requires-recent-login`, the Firestore data has already been
deleted. The user must sign in again and return to the Delete Account screen to complete
the final auth-account deletion.

**Limitation — recursive sub-collection deletion:** The Firestore Web SDK cannot
atomically delete an entire collection hierarchy in one request. `AccountDeletionService`
pages through sub-collections in batches of 200 documents. For users with very large
journey histories (thousands of location updates), this could be slow or partially fail
under poor network conditions. Partial failures are captured in `result.partialErrors`.
Consider supplementing with a Cloud Function (Firebase Admin SDK) that triggers on account
deletion and cleans up any remaining orphaned documents server-side.

---

## 7. Cross-cutting concerns not yet implemented

| Item | Status | Notes |
|---|---|---|
| Firebase App Check | Not implemented | Prevents API abuse by unverified clients. Recommended before public launch. See `APP_CHECK.md` for the staged rollout plan and why enforcement order matters. |
| Certificate pinning | Not implemented, deliberately | Pinning the wrong cert/key breaks all networking for every user until an app-store update ships a fix, and Firestore's JS SDK in RN doesn't necessarily route through the same stack most RN pinning libraries hook. Needs real investigation against a real device and a real Firebase project, not a blind add. |
| Jailbreak / root detection | Implemented, as a warning | `jail-monkey`-backed `DeviceIntegrityProvider` checks `isJailBroken()`/`hookDetected()` once per launch, shown via a dismissible `Alert` in `app/_layout.tsx`. Deliberately never blocks app use — a false positive locking someone out of SOS would be worse than an ignorable warning. |
| Biometric re-auth for SOS resolve | Implemented | `useSOS().resolveSOSWithAuth()` runs the same biometric gate as account deletion before resolving an active SOS; falls back to no gate on devices without biometrics configured, same as account deletion. |
| Duress / silent-SOS code | Implemented | A separate PIN, set in Privacy & Security, that "fake-resolves" an SOS from the victim's screen while leaving `status` ACTIVE and tracking running server-side — see `IMPLEMENTATION_PLAN.md`'s duress item for the full writeup and its known limitation (doesn't survive a cold app restart). |
| Server-side scheduled deletion | Implemented | `enforceDataRetention` Cloud Function (`functions/src/index.ts`), runs daily. See `DATA_RETENTION.md`. SOS_TRIGGERED-status journeys are a deliberate exception — retained indefinitely, not an open gap. |
| Server-side missed check-in detection | Implemented | `detectMissedCheckIns` Cloud Function, runs every 2 minutes, backstops the client-side timer in `CheckInContext`. See `IMPLEMENTATION_PLAN.md` Phase 1. |
| Account-deletion Cloud Function safety net | Implemented | `onUserAccountDeleted` (`firebase-functions/v1` auth trigger) sweeps any Firestore data a client-side deletion left behind. See `DATA_RETENTION.md`. |
| Stale FCM token pruning | Implemented | `sendAlerts()` in `functions/src/index.ts` clears `fcmToken` on a contact's user doc when delivery fails with a permanent "not registered"/"invalid" error, instead of retrying a dead token forever. |
| Entitlements / paid-tier enforcement | Not implemented, blocked | Needs a real payment processor account (RevenueCat/Stripe) before there's anything to wire against — see `IMPLEMENTATION_PLAN.md` Phase 4. |
| Analytics / crash reporting | Not added, blocked | Needs a real Sentry project or Firebase Crashlytics before there's a DSN/config to wire the SDK against — see `IMPLEMENTATION_PLAN.md` Phase 5. Keeps PII risk low in the meantime, but "blind in production" is its own risk. |

---

## 8. Trusted contacts — PII belonging to someone else

Every other section of this review covers the app user's own data. Trusted contacts are a
different case: a contact's name and phone number are *their* PII, entered into Firestore by
someone else, and the contact never signs in, never sees this data, and today has no way to know
it's there.

**Where it lives:**

| Data | Storage | Who can read it |
|---|---|---|
| Contact name, phone, relationship | Firestore `users/{ownerId}/contacts/{contactId}` | Only the owning user, via `firestore.rules` (`allow read: if isOwner(userId)`) — never the contact themselves, never another wayLoc user. |

**Server-side cross-user read (bypasses client rules by design):** `getContactFcmTokens()` in
`functions/src/index.ts` reads a user's contact phone numbers, then queries the top-level `users`
collection for accounts whose `phone` field matches — this is how a contact who *also* has
wayLoc installed gets found and pushed an SOS/missed-check-in alert. This is a legitimate,
necessary cross-user lookup (it's the entire alerting mechanism), done with the Admin SDK, which
is not subject to `firestore.rules` at all. It only ever reads `fcmToken`; it never writes to or
otherwise exposes another user's document. Contacts without a matching wayLoc account are
silently skipped — no data about them leaves the owner's own contact list.

**What's exported:** `DataExportService`'s "download my data" feature includes the requesting
user's own contacts list (name, phone, relationship) in the JSON handed to them — this is the
user's own address book, not a contact's data being sent *to* the contact, so it's the same
category as exporting your own phone's contacts app.

**Open question, not resolved here:** a trusted contact has no visibility into being listed, no
notification that it happened, and no self-service way to have their name/number removed from
someone else's wayLoc account short of asking that person to delete it (`removeMember`/contact
deletion is owner-only, by rule design). Under GDPR/DPDP this is "third-party personal data
processed on behalf of the data controller (the app user), not the data subject" — a legally
normal pattern (identical to any phone contacts app or messaging app's address book), but worth a
real legal read before treating it as settled, same caveat already on the Privacy Policy/Terms
content in `IMPLEMENTATION_PLAN.md` Phase 2.
