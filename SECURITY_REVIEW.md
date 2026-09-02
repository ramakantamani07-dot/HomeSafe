# HomeSafe Security Review

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
  server; coordinates sent for routing are not logged by HomeSafe.

---

## 5. Sensitive console logging

- No `console.log` of phone numbers, auth tokens, GPS coordinates, or user IDs was found
  in production paths at the time of this review.
- `__DEV__` guards in `LowBatteryBanner` limit diagnostic output to development builds.
- Production builds should enable ProGuard / Metro minification which strips dead code
  but does not remove console calls — add `babel-plugin-transform-remove-console` to
  `babel.config.js` for production if verbose logging is added in the future.

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
| Firebase App Check | Not implemented | Prevents API abuse by unverified clients. Recommended before public launch. |
| Certificate pinning | Not implemented | `expo-ssl-pinning` can pin the Firebase and OSRM endpoints. |
| Jailbreak / root detection | Not implemented | `expo-root-jailbreak` or similar. Consider for v2. |
| Biometric re-auth for SOS resolve | Partial | Biometric is required for account deletion. SOS resolve currently has no re-auth step. |
| Server-side scheduled deletion | Implemented | `enforceDataRetention` Cloud Function (`functions/src/index.ts`), runs daily. See `DATA_RETENTION.md`. SOS_TRIGGERED-status journeys remain an open gap (no `endedAt` to measure age from). |
| Server-side missed check-in detection | Implemented | `detectMissedCheckIns` Cloud Function, runs every 2 minutes, backstops the client-side timer in `CheckInContext`. See `IMPLEMENTATION_PLAN.md` Phase 1. |
| Account-deletion Cloud Function safety net | Not implemented | `auth.user().onDelete()` trigger to sweep any Firestore data a client-side deletion left behind. See `DATA_RETENTION.md`. |
| Analytics / crash reporting | Not added | No Crashlytics or Analytics SDK is included, keeping PII risk low. |
