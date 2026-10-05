# wayLoc — Implementation Plan

Tracking doc for everything identified as missing, weak, or incomplete versus (a) basic
production-readiness, (b) privacy/compliance obligations for a personal-safety app handling
location + PII, and (c) competitive parity with bSafe / Life360 / Kitestring (per the
comparison table on the marketing site).

**How to use this file:** work top to bottom within a phase. Check items off as they land.
Each item has a "Why" so priority calls can be re-justified later without re-deriving context.
Add new gaps here as they're found — don't let anything surface only in chat history.

Legend: 🔴 blocks real user data / launch · 🟡 should land before public launch · 🟢 post-launch OK

---

## Phase 0 — Firestore rules hardening (do first, before real data flows through it)

- [x] 🔴 **Enforce family-status sharing permissions in security rules, not just app code.**
  Done via the "correct fix" option: `familyStatus` under `users/{userId}` is now owner-only
  (no cross-user read grant at all), and a new `familyConnections/{connectionId}/sharedStatus/{publisherUserId}`
  subcollection holds a per-connection view that's already permission-filtered *at publish time*
  (`FamilyService.publishStatus` → `deriveSharedView` in `src/models/Family.ts`). Rules for the
  new subcollection only check connection membership — there's no sharingMode/shareBattery/etc.
  logic left in the rules to get wrong, because the document a viewer can read already contains
  only what the publisher chose to share with them. Touched: `firestore.rules`,
  `src/providers/FamilyProvider.ts` (split into `publish/getOwnStatus` +
  `publish/getSharedStatus`), `FirebaseFamilyProvider.ts`, `MockFamilyProvider.ts`,
  `FamilyService.ts` (`publishStatus` now fans out to every active connection;
  `getFamilyMembers` reads the pre-filtered view instead of filtering at read time).
- [x] 🔴 **Restrict `familyConnections` permission-field writes to the owning party.**
  `firestore.rules` update rule now requires `user1Permissions` to be unchanged unless
  `request.auth.uid == user1Id` (and symmetrically for `user2Permissions`).
- [x] 🟡 Add schema/shape validation to rules — `isReasonableString()` helper enforces type +
  length bounds on `contacts.name`/`.phone` and `journeys.destinationLabel` on create/update, using
  the safe `.get(field, default)` accessor so a missing field fails validation cleanly instead of
  erroring. **Deferred, not done:** server-side enforcement of `contacts` count ≤ `MAX_CONTACTS` —
  Firestore rules can't count a collection's size without a maintained counter field, which is a
  bigger change (needs a transactional counter on the user doc). Left as a follow-up; app-level
  enforcement in `Contact.ts`/`ContactService` is what exists today.
- [x] 🟡 Disallow `locationUpdates` delete while a linked SOS on that journey is `ACTIVE`.
  Implemented by checking the parent journey's own `status != 'SOS_TRIGGERED'` (that status value
  already existed on `Journey` — no new field needed) rather than cross-referencing `sosEvents`,
  since rules can't run arbitrary queries against another collection.
- [x] 🟢 Extended `src/__tests__/firestoreRules.test.ts` with emulator tests for all of the above
  (sharedStatus read/write membership checks, permission-field spoofing, SOS-locked delete) plus
  static content assertions that run without the emulator. Updated `familyService.test.ts` to
  seed data through the real `publishStatus` path instead of a raw read-time seed, so the unit
  tests exercise the actual filtering logic.
  **Now actually verified against a real emulator** (was previously only hand-traced — see
  `npm run test:emulator`, added in a later session): all 27 rules tests pass for real, including
  the 19 that were emulator-gated. Getting this working required two real fixes, not just
  installing a package:
  1. `@firebase/rules-unit-testing@latest` requires `firebase@^12`, but this app pins
     `firebase@^10.14.0` — installed the version-matched `@firebase/rules-unit-testing@3.0.4`
     instead of silently force-upgrading the app's Firebase SDK as a side effect.
  2. That package pulls in `firebase/compat/*` files containing raw ESM `import` syntax, which
     the RN/Expo `jest-expo` preset's `transformIgnorePatterns` (node_modules excluded from
     transform) can't parse. Split `jest.config.js` into two Jest **projects** — `app` (unchanged
     RN/Expo suite) and `rules` (plain Node environment, its own `transformIgnorePatterns` that
     allows `firebase`/`@firebase` through) — rather than loosening the RN suite's config globally.
  Also had to re-gate `rulesTestingAvailable` on `process.env.FIRESTORE_EMULATOR_HOST` being set,
  not just the package being importable — otherwise a plain `npm test` with no emulator running
  hard-fails 19 tests with connection-refused errors instead of skipping, the moment the package
  is added as a dependency. `firebase emulators:exec` sets that env var automatically for its
  child process; a bare `emulators:start` does not (for your own shell).

## Phase 1 — Reliability: server must be the source of truth, not the client

- [x] 🔴 **Server-side missed check-in detection.** `functions/src/index.ts` now exports
  `detectMissedCheckIns`, an `onSchedule('every 2 minutes', ...)` function that queries the
  `journeys` collection group for `status == 'ACTIVE' && nextCheckInAt <= now - grace - buffer`
  and flips matches to `MISSED_CHECKIN`. It deliberately adds a 1-minute safety buffer on top of
  the client's own `GRACE_PERIOD_MINUTES` (5 min) so it can't race a user who's actively
  confirming safe — the client stays the fast path when it's alive; this is purely the backstop
  for when it isn't. Reuses the existing `onMissedCheckIn` trigger for the actual alert, so
  detection and notification stay separate regardless of which side wrote the status change.
  Worst-case detection latency if the client never runs at all: ~8 minutes (5 grace + 1 buffer +
  up to 2 for the next scheduler tick).
- [x] 🔴 **Server-side scheduled data retention enforcement.** `enforceDataRetention`
  (`onSchedule('every 24 hours', ...)`) purges `locationUpdates` for `COMPLETED` journeys past 30
  days and `CANCELLED`/`MISSED_CHECKIN` journeys past 7 days (via `endedAt`), and deletes
  `RESOLVED` `sosEvents` past 90 days (via `resolvedAt` — an unresolved/`ACTIVE` SOS record is
  never touched regardless of age). Native Firestore TTL was considered and rejected: TTL can't
  express "different retention by status" or "only if resolved," both of which this policy needs.
  **Known gap, not guessed at:** `SOS_TRIGGERED`-status journeys have no `endedAt`
  (`JourneyProvider` leaves it null on that transition since an SOS doesn't necessarily end the
  journey), so there's currently no defined age to measure retention from for that status — see
  `DATA_RETENTION.md` for the full writeup.
- [x] 🟡 **Account-deletion Cloud Function safety net.** `onUserAccountDeleted` — sweeps
  `contacts`, `sosEvents`, `familyStatus`, and every journey's `locationUpdates`/`checkIns` for
  the deleted uid, then the `users/{uid}` doc itself; cancels (never hard-deletes, matching the
  client-side `removeMember` convention and the rules that already forbid client deletes here)
  any `familyConnections` involving that uid and removes the deleted user's `sharedStatus` entry
  from each; deletes `familyInvitations` the uid sent. Idempotent with the client-side
  `AccountDeletionService` — if that already succeeded, every query here returns empty. **Uses
  the legacy `firebase-functions/v1` namespace** since v2 still has no `auth().onDelete()`
  equivalent (open upstream since before this project started — see comment in
  `functions/src/index.ts`); v1 and v2 triggers are explicitly supported to coexist in one
  codebase, but this is worth knowing about if Firebase ever sunsets v1 outright. **Deliberately
  not covered:** pending invitations addressed *to* the deleted user's phone number — an
  invitation targets a phone number, not an account, so it may still be meaningful if that number
  is reused later.
- [x] 🟢 **Stale FCM token pruning.** `getContactFcmTokens` now returns `{userId, token}` pairs
  instead of bare strings — needed so a delivery failure can be traced back to the doc that needs
  clearing. New exported pure function `isDeadTokenError(code)` classifies
  `messaging/registration-token-not-registered` and `messaging/invalid-registration-token` as
  permanently dead (vs. transient failures like rate-limiting, which are left alone to retry);
  `sendAlerts()` clears `fcmToken` on the owning `users/{uid}` doc for any token that comes back
  dead. Exported as a pure function specifically so the classification itself — the part most
  likely to be gotten wrong, either over-pruning a working token or retrying a dead one forever —
  is unit-testable without an Admin SDK connection.
- [x] 🟢 **Decided: `SOS_TRIGGERED` journeys' location trail is retained indefinitely**, not
  purged on any schedule — see the rewritten writeup in `DATA_RETENTION.md`. Reasoning: a normal
  resolve already moves the journey to `COMPLETED` with `endedAt` set, so ordinary 30-day retention
  picks it up from there; the only journeys left stuck at `SOS_TRIGGERED` are ones nobody ever
  resolved, or ones resolved with the duress code (which by design leaves status untouched) — both
  are exactly the data an actual emergency touched, kept for as long as anyone might need to
  reconstruct what happened, same reasoning as why unresolved SOS event records are never
  auto-deleted either. Also surfaced in the user-facing retention table on the Privacy & Security
  screen ("GPS trail — journey with an unresolved SOS: Kept until resolved") rather than left as a
  silent gap in what users are told.
- [x] 🟢 **Test coverage for the Cloud Functions.** `functions/` had no test harness at all before
  this — added `jest` + `ts-jest` (`functions/jest.config.js`, `jest.setup.js` to set
  `GCLOUD_PROJECT` so importing `index.ts` doesn't need real credentials or a live emulator; that
  module-scope `initializeApp()` call was confirmed safe to import bare via a real
  `require('./lib/index.js')` check before building on it). Scoped to the highest-value slice
  rather than the full surface: 4 new tests on `isDeadTokenError` specifically, since that's the
  one piece of new logic where a wrong answer silently breaks something (either direction). Full
  request/response testing of the Firestore triggers themselves would need
  `firebase-functions-test` plus either heavy mocking or the emulator — a real follow-up, not
  attempted here. **Also fixed a real bug this surfaced:** the root `jest.config.js`'s `testMatch`
  had no `<rootDir>` anchor, so running `npm test` from the repo root picked up
  `functions/src/__tests__/**` too and crashed trying to load `firebase-admin`/`firebase-functions`
  under the RN/Expo test environment — rooted both project configs under `<rootDir>/src/__tests__`
  to fix it. Verified via both `npm test` and `npm run test:emulator` (160/160 passing) after the
  fix, not just the isolated `functions/` suite.

**Also added in this pass (infrastructure that was silently missing):** `firebase.json` and
`firestore.indexes.json` didn't exist before — there was no way to actually deploy the rules,
functions, or the composite indexes these new collection-group queries require. Both are now in
the repo. **Still needed from you:** a `.firebaserc` pointing at your actual Firebase project ID —
not fabricated here since it's a real project identifier, not something to guess. Run
`firebase use --add` once you have a project. Then `firebase deploy --only firestore:indexes` for
the new indexes and `firebase deploy --only functions` for the two scheduled functions.

## Phase 2 — Privacy & compliance basics

- [x] 🔴 **In-app Privacy Policy / Terms screen**, linked from the phone-auth disclaimer.
  New `(legal)` route group (`app/(legal)/privacy-policy.tsx`, `app/(legal)/terms.tsx`, shared
  `LegalDocumentScreen` renderer) reachable both signed-out and signed-in — required a small
  `NavigationGuard` change in `app/_layout.tsx` to exempt that group from the auth redirect in
  both directions, otherwise a signed-out visitor got bounced straight back to `/phone`. Linked
  from the `phone.tsx` disclaimer (now tappable, was static text) and added under Privacy &
  Security so it's reachable any time, not just at signup.
  **Content is a grounded draft, not lawyer-reviewed** — every factual claim (retention periods,
  what's stored where, sharing behavior) is pulled from `DATA_RETENTION.md`/`SECURITY_REVIEW.md`
  rather than invented, and the Terms' limitation-of-liability and governing-law clauses are
  exactly the kind of language that needs real legal review before this app is handling real
  users' safety data — flagging clearly rather than presenting this as launch-ready. The minors
  clause in the Privacy Policy is a conservative placeholder ("intended for 18+, parent/guardian
  manages a minor's sharing") that will need revisiting once the separate "decide the minors
  question" item below is actually resolved — don't let these two drift out of sync.
- [x] 🟡 **Data export ("download my data").** Done. New `DataExportProvider` (read-side
  counterpart to `AccountDeletionProvider` — same collections: contacts, journeys +
  locationUpdates/checkIns, sosEvents — read instead of deleted, paginated the same way) +
  `DataExportService`, which also pulls the local SecureStore profile (name/phone/settings —
  never in Firestore to begin with) and assembles everything into one JSON file via
  `expo-file-system`'s new class-based API (`File`/`Paths` — verified this project's installed
  version uses the newer synchronous API, not the old `writeAsStringAsync` one, before writing
  against it), handed to the OS share sheet via `expo-sharing`. Nothing is uploaded anywhere —
  reads what's already there and hands it directly to the user. New "Download my data" card on
  the Privacy & Security screen. `expo-file-system` ships a config plugin (Android storage
  permissions) that needed registering in `app.config.ts` — verified via a real prebuild, same
  discipline as the `expo-task-manager` fix. 5 new tests (mocking `expo-file-system`/
  `expo-sharing` directly, same reasoning as the `expo-notifications` mock in `fakeCall.test.ts` —
  without a mock the service's own try/catch silently swallows every call). Full suite now 120
  passed (up from 115).
- [x] 🟡 **In-app background-location priming screen** before the OS "Always Allow" prompt.
  Done. `PermissionExplainerModal` gained a `'locationBackground'` content variant explaining why
  "Always Allow" matters (tracking otherwise pauses the moment the app leaves the foreground).
  Wired into `app/(app)/start-journey.tsx`: `handleStart` now checks `locationBackgroundStatus`
  from `usePrivacy()` before calling `startJourney` — if it's still `'undetermined'`, the params
  are stashed and the primer shows first; tapping Continue proceeds into `startJourney`, which is
  what actually triggers the real OS prompt via `ExpoLocationProvider.ensureBackgroundPermission()`.
  Only shown once per install in practice, since the OS status stops being `'undetermined'` after
  the first real prompt either way. "Not now" just cancels the pending start with no side effects.
- [x] 🟡 **Decide the minors question explicitly.** Decided: wayLoc accounts are 18+, a parent
  or guardian holds the account and manages sharing for a minor family member — matching the
  clause already drafted into the Privacy Policy/Terms in Phase 2. **Now actually enforced, not
  just stated**: `app/(auth)/phone.tsx` has a required "I confirm I am 18 or older" checkbox
  (skipped only in dev mode, same as the ToS/Privacy disclaimer already was) — the Send OTP button
  stays disabled until it's checked. Deliberately not persisted as a server-side attestation
  record — the checkbox gate is the actual enforcement; a durable compliance record is a separate
  decision for legal counsel, not guessed at here. Still open: the marketing copy itself
  ("children walking home from school" as a use case) reads oddly against an 18+-only account
  model and should probably be revised to frame it as "a parent tracks their child's walk home"
  rather than implying the child holds the account — a copy fix on the marketing site, not
  something touched in this pass.
- [x] 🟢 **"Who can see my data" transparency screen.** Done, no new data plumbing needed —
  `myPermissions` was already computed per connection in `FamilyService.getFamilyMembers`. New
  `app/(app)/data-visibility.tsx`, linked from a new card at the top of Privacy & Security's "Your
  Data" section: one card per family connection showing their sharing mode plus a per-category
  ✓/✕ breakdown (status, live location, journey details, battery), with a note when
  `SHARE_DURING_JOURNEY` mode means the ✓s only apply while a journey is active. Tapping a card
  deep-links to `family-member.tsx` to actually change it — this screen is read-only by design, a
  single glanceable answer to "what can they see right now," not a second place to edit permissions.
- [x] 🟢 **Document contacts' PII handling in `SECURITY_REVIEW.md`.** Added as new §8: where it's
  stored and who can read it (owner-only via `firestore.rules`), the legitimate server-side
  cross-user read in `getContactFcmTokens()` that the Admin SDK bypasses rules for (documented as
  intentional and scoped — reads `fcmToken` only, never exposes anything else), what "download my
  data" does and doesn't do with it, and an explicitly flagged open question: a contact has no
  visibility, no notification, and no self-service removal path today, which is legally normal for
  third-party data processed on a controller's behalf but still worth real legal review, same
  caveat already attached to the Privacy Policy/Terms content. Also used this pass to correct
  several other rows in §7's status table that had drifted stale relative to work already done
  earlier in this session (jailbreak detection, SOS biometric re-auth, account-deletion Cloud
  Function, console stripping all previously said "Not implemented") — an inaccurate security
  document is worse than an incomplete one.

## Phase 3 — Security hardening (SECURITY_REVIEW.md's own open list)

- [ ] 🔴 **Firebase App Check.** Firebase config ships inside the app bundle; without App Check,
  anyone can hit Firestore directly with it. Do this before any real-user data goes in — it's the
  actual boundary the rules in Phase 0 rely on being talked to only by real app instances.
- [x] 🟡 **Biometric re-auth step before resolving an active SOS.** Done, same pattern as account
  deletion. `useSOS()` (`src/hooks/useSOS.ts`) now composes `SOSContext` with `usePrivacy()` and
  exposes `resolveSOSWithAuth()` — when `biometricAvailable`, it runs `unlockWithBiometric()`
  before calling the real `resolveSOS()`, returning `{success, error}` directly (not stale state)
  so the caller doesn't hit the same stale-closure trap fixed in the data-export work.
  `emergency-mode.tsx` calls `resolveSOSWithAuth()` instead of the raw context method and derives
  its busy spinner from the new `resolveStage` ('idle'/'authenticating'/'resolving'/'error')
  instead of a local `useState`. Devices without biometrics configured skip straight to resolving,
  same fallback as account deletion.
- [x] 🟡 **Duress/silent-SOS code.** Done. `SOSEvent` gained a `duressTriggered` field
  (`SOSProvider.markDuress`, implemented in both `FirebaseSOSProvider` and `MockSOSProvider`)
  that's set on an active event WITHOUT touching `status`/`resolvedAt` — no Firestore rule change
  needed, the existing owner-update rule already allows any field except `userId`/`triggeredAt`/
  `createdAt`. `SOSContext.triggerDuress()` calls it, swallows any failure (an error dialog would
  break the cover story in front of exactly the person the victim is placating), and clears local
  `activeSOS` state without touching `sosTracking` or the journey — tracking keeps running at SOS
  priority and the alert stays live for contacts, only the local screen looks resolved. New secure
  storage (`SecureDuressStore.ts`, plaintext in `expo-secure-store` like the session token — no new
  hashing dependency needed since SecureStore is already hardware-encrypted at rest) backs a
  `duressCodeSet`/`setDuressCode`/`removeDuressCode`/`verifyDuressCode` set on `PrivacyContext`,
  managed from a new "Duress Code" card in Privacy & Security. New shared `PinEntryModal`
  component (same bottom-sheet pattern as `PermissionExplainerModal`) handles both setting it
  (two-step enter/confirm) and, on `emergency-mode.tsx`, a deliberately generic "Enter code
  instead" link next to the real resolve button — its modal copy never says "duress" so its mere
  presence can't out the feature to someone watching over the victim's shoulder. 5 new tests in
  `duress.test.ts`. **Known limitation, not solved here:** this only holds within the running app
  session — there's no realtime listener on `activeSOS`, so a cold restart re-fetches the still-
  ACTIVE event from Firestore and would route back into `emergency-mode.tsx`. Acceptable for the
  immediate-compliance scenario the feature targets, but worth flagging before relying on it
  surviving a phone being put away and picked back up later.
- [ ] 🟢🔒 **Certificate pinning for Firebase + OSRM — deliberately not attempted, high blast
  radius for a guess.** Pinning against the wrong cert/key doesn't degrade gracefully — it breaks
  all networking for every user until an app-store update ships a fix, and Firestore's JS SDK in
  RN doesn't necessarily route through the same `fetch`/native networking stack most RN pinning
  libraries hook (it falls back to its own long-polling transport), so "just add a pinning
  library" isn't obviously correct here without testing against a real device and a real Firebase
  project — neither exists yet (see P0 #2 elsewhere in this doc). Worth real investigation once
  both do, not a blind implementation now.
- [x] 🟢 **Jailbreak / root detection.** Done as a warning, not a block — deliberately chose
  "flag" over "soft-block" from the two options this item allowed: a false positive locking
  someone out of SOS during a real emergency would be worse than an ignorable warning on a
  genuinely compromised device. New `DeviceIntegrityProvider` interface + `jail-monkey`-backed
  `ExpoDeviceIntegrityProvider` (checks `isJailBroken()` and `hookDetected()`), `Mock` version
  always reporting clean. `jail-monkey`'s native module throws when unlinked (unbuilt dev client,
  or no rebuild since install) rather than returning `false` — deliberately NOT swallowed as "not
  compromised" inside the library itself, so the provider's own try/catch is what turns that into
  "inconclusive, don't warn" rather than it happening silently. Verified via a real
  `npx expo prebuild --platform ios` that the package autolinks cleanly (has both a `.podspec` and
  an Android `build.gradle`, no Expo config plugin needed). Wired into `app/_layout.tsx` as a
  one-time check per launch showing a dismissible `Alert` — never blocks app use. 4 new tests.
- [x] 🟢 **Strip `console.log` in production builds.** Done via
  `babel-plugin-transform-remove-console`, gated on `NODE_ENV === 'production'` in
  `babel.config.js`, keeping `console.error`/`console.warn` so crash-adjacent signal isn't lost.
  No PII was found in logs at last review, but this closes the door structurally rather than by
  audit — a future debug `console.log` left in won't ship to device logs in production builds.

## Phase 4 — Competitive parity gaps (from the bSafe / Life360 / Kitestring comparison)

- [ ] 🔴 **SMS fallback for contacts without the app.** `functions/src/index.ts` explicitly notes
  "SMS alerts for non-app contacts are out of scope" — but the website sells "SMS alerts (no app
  needed)" as a Family-tier feature, and it's table stakes vs. Life360/bSafe. Wire Twilio (or
  similar) into `sendAlerts()` as a fallback when a contact has no FCM token.
- [x] 🟡 **Live location on the family map.** Done at the data layer, deliberately scoped short
  of an embedded map. `FamilyStatusSnapshot`/`SharedFamilyView`/`FamilyMember` all gained a
  `location: Coordinates | null` field; `deriveSharedView` gates it on the existing
  `shareLocation` permission (was already collected in the UI but never actually used for
  anything) — same fan-out/permission-filtering path every other field goes through, no Firestore
  rule change needed since the per-connection `sharedStatus` doc has no field whitelist.
  `FamilyContext.tsx` now feeds `currentLocation` from `LocationTrackingContext` into
  `publishStatus` and re-publishes on every change — that stream is already throttled by
  `TrackingConfig` (10-60s depending on mode), so this adds no new write frequency. Also gated
  location specifically (not just status) on the existing 30-minute staleness check in
  `FamilyService.getFamilyMembers` — a stale pin shown as "live" is actively misleading for a
  safety app in a way a stale ETA text isn't, so this is stricter than how other fields behave.
  `family-member.tsx` shows the coordinates plus an "Open in Maps" link (`https://maps.google.com`)
  rather than an embedded pin. **Deliberately not built:** an actual in-app map view — this app
  has no map SDK dependency at all (`react-native-maps` or equivalent), which would mean a new
  native dependency, Google/Apple Maps API keys, and prebuild config, the same category of decision
  as the native widget/Apple-dev-account items already flagged elsewhere. Worth a real "do we want
  a map" decision before building it, not assuming yes by default. 4 new tests.
- [ ] 🟡🔒 **Entitlements / paid-tier enforcement — blocked on an external account, not code.**
  `MAX_CONTACTS = 10` is still a single hardcoded constant with no tier awareness. What's actually
  missing isn't logic — it's a real payment processor account (RevenueCat is the standard
  Expo-friendly choice; Stripe is the alternative if this ever needs web billing too) and, once
  that's chosen, real subscription products configured in App Store Connect / Play Console, both
  of which sit behind the same paid Apple Developer Program enrollment already tracked as blocked
  elsewhere in this doc. Deliberately did not build a placeholder `EntitlementProvider` that reads
  a fake tier from nowhere real — that would be a half-finished implementation that *looks* done
  without doing anything, exactly the kind of thing worth avoiding. Once an account exists: add a
  subscription SDK, an entitlement field synced to the user doc via webhook, and server-side gating
  (Firestore rules or Cloud Functions) — not just client UI hiding buttons.
- [ ] 🟢 B2B/admin dashboard (schools, NHS, lone-worker programmes) — marketed on the site,
  doesn't exist in any form (no web admin surface at all).
- [ ] 🟢 AI features (anomaly detection, route risk scoring, voice SOS, predictive alerts,
  AI safety assistant) — fully marketed, fully unbuilt. Needs its own scoping pass; not a "small
  bit," treat as a separate roadmap once Phases 0–3 are done. Until scoped, consider softening the
  marketing copy so the site doesn't oversell current app capability.

## Phase 5 — Observability (currently blind in production)

- [ ] 🟡🔒 **Privacy-scrubbed crash/error reporting — blocked on an external account, not code.**
  Needs a Sentry project (or Firebase Crashlytics, which would piggyback on the same real Firebase
  project already blocking P0 #2/deploys elsewhere in this doc) — there's no DSN/config to wire the
  SDK against without one, and guessing at scrubbing-rule config against a service with no real
  project to test it in risks writing integration code that looks right but has never actually
  scrubbed a real breadcrumb. Once a project exists: add the SDK, and write the PII-scrubbing rule
  (no phone numbers/coordinates/tokens in breadcrumbs) as the first thing that ships with it, not
  as a follow-up — "blind in production" is its own risk for a safety-critical app, but so is a
  crash reporter that leaks exactly the data this app exists to protect.
- [ ] 🟢 Cloud Function alert-delivery metrics/alerting (today `sendAlerts()` just logs
  ok/failed counts — no dashboard or paging if delivery failure rate spikes).

---

## Notes on sequencing

Phases 0–1 are the two things that would actually hurt a real user if skipped (a privacy-setting
bypass, and a safety feature that silently doesn't fire). Phase 2 is legal/compliance exposure.
Phase 3 closes the security review's own known gaps. Phase 4 is where "small bits vs. competitors"
mostly lives — SMS fallback and live family location are the two that most directly match
marketed claims to nothing. Phase 5 can happen anytime alongside the others.

Do not start Phase 4's AI section until 0–3 are done — it's the biggest single gap but also the
least urgent relative to correctness/privacy/security, and shouldn't block getting Firestore
integration itself onto solid ground first.
