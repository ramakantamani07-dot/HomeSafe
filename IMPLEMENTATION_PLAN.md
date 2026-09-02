# HomeSafe — Implementation Plan

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
  tests exercise the actual filtering logic. **Not yet done:** these were verified by running the
  full local test suite (`npm test` — 106 passed) and by hand-tracing every new emulator-gated
  case against the rule logic, but the emulator itself (`@firebase/rules-unit-testing` +
  `firebase-tools`, which needs a JRE) isn't installed in this environment, so the 19
  emulator-gated tests are still skipped here. **Run `firebase emulators:start --only firestore`
  and `npx jest --testPathPattern=firestoreRules` locally before deploying these rules.**

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
- [ ] 🟡 **Account-deletion Cloud Function safety net** — `auth.user().onDelete()` trigger that
  sweeps any Firestore data left behind if the client-side `AccountDeletionService` sequence was
  interrupted (documented as a known limitation in `SECURITY_REVIEW.md` §6). **Not done yet** —
  next up in this phase.
- [ ] 🟢 Stale FCM token pruning — when `messaging.send()` returns "not registered" in
  `functions/src/index.ts`, delete that token from the user doc instead of silently failing every
  time.
- [ ] 🟢 **New from this pass:** decide and implement a retention rule for `SOS_TRIGGERED`
  journeys' location trail (see gap above) — likely needs either a `resolvedAt`-equivalent field
  on the journey itself, or cross-referencing the linked `sosEvents.resolvedAt`.
- [ ] 🟢 **New from this pass:** add test coverage for the two new Cloud Functions. The
  `functions/` project currently has no test harness at all (pre-existing gap, not introduced
  here) — would need `firebase-functions-test` or equivalent mocking to unit-test the query/batch
  logic without a live emulator.

**Also added in this pass (infrastructure that was silently missing):** `firebase.json` and
`firestore.indexes.json` didn't exist before — there was no way to actually deploy the rules,
functions, or the composite indexes these new collection-group queries require. Both are now in
the repo. **Still needed from you:** a `.firebaserc` pointing at your actual Firebase project ID —
not fabricated here since it's a real project identifier, not something to guess. Run
`firebase use --add` once you have a project. Then `firebase deploy --only firestore:indexes` for
the new indexes and `firebase deploy --only functions` for the two scheduled functions.

## Phase 2 — Privacy & compliance basics

- [ ] 🔴 **In-app Privacy Policy / Terms screen**, linked (not just named) from the phone-auth
  disclaimer in `app/(auth)/phone.tsx`. Currently it's unlinked prose; GDPR/DPDP and both app
  stores expect the actual policy reachable at the point of consent.
- [ ] 🟡 **Data export ("download my data").** Deletion exists (`AccountDeletionService`), export
  doesn't. GDPR Art. 20 / DPDP data-portability right. Can reuse the same collection-walk logic
  `AccountDeletionService` already has, output as JSON instead of deleting.
- [ ] 🟡 **In-app background-location priming screen** before the OS "Always Allow" prompt —
  `PermissionExplainerModal` already does this pattern for foreground location/notifications;
  extend it to background, since Apple review expects an in-app explanation first for
  `NSLocationAlwaysAndWhenInUseUsageDescription`.
- [ ] 🟡 **Decide the minors question explicitly.** Marketing copy mentions "children walking
  home from school" as a use case; there's no age gate, parental consent, or COPPA/UK Age
  Appropriate Design Code handling anywhere. Either scope minors out of v1 messaging/ToS or design
  consent for it — don't leave it implicit.
- [ ] 🟢 "Who can see my data right now" summary screen — you already compute
  `theirPermissions`/`myPermissions` per connection in `FamilyService`; surfacing it as a single
  glanceable list is a strong trust/transparency feature and needs no new data plumbing.
- [ ] 🟢 Document contacts' PII handling explicitly in `SECURITY_REVIEW.md` (trusted contacts'
  names/phone numbers are someone *else's* PII, stored in Firestore, not covered by the existing
  SecureStore-vs-Firestore table).

## Phase 3 — Security hardening (SECURITY_REVIEW.md's own open list)

- [ ] 🔴 **Firebase App Check.** Firebase config ships inside the app bundle; without App Check,
  anyone can hit Firestore directly with it. Do this before any real-user data goes in — it's the
  actual boundary the rules in Phase 0 rely on being talked to only by real app instances.
- [ ] 🟡 Biometric re-auth step before resolving an active SOS — currently only account deletion
  requires it. Matters both directions: raises friction for a coercer forcing a "resolve", and
  prevents accidental resolves from a locked/pocketed device.
- [ ] 🟡 Duress/silent-SOS code — a PIN variant of "resolve" that looks like it cancelled the
  alert but secretly keeps contacts notified. Common differentiator in this category (Kitestring-
  style), currently absent.
- [ ] 🟢 Certificate pinning for Firebase + OSRM endpoints (`expo-ssl-pinning` or equivalent).
- [ ] 🟢 Jailbreak / root detection — flag or soft-block on compromised devices given the app
  handles emergency data.
- [ ] 🟢 Strip `console.log` in production builds (`babel-plugin-transform-remove-console`) — no
  PII was found in logs at last review, but this closes the door structurally rather than by audit.

## Phase 4 — Competitive parity gaps (from the bSafe / Life360 / Kitestring comparison)

- [ ] 🔴 **SMS fallback for contacts without the app.** `functions/src/index.ts` explicitly notes
  "SMS alerts for non-app contacts are out of scope" — but the website sells "SMS alerts (no app
  needed)" as a Family-tier feature, and it's table stakes vs. Life360/bSafe. Wire Twilio (or
  similar) into `sendAlerts()` as a fallback when a contact has no FCM token.
- [ ] 🟡 **Live location on the family map is not actually wired up.** `FamilyStatusSnapshot` has
  no lat/lng field — family members currently see destination/ETA/status text, not a live pin,
  despite "see every family member's live status... in one place" being the pitch. Decide: extend
  the per-connection status doc (Phase 0) to include a coarse/live position gated by
  `shareLocation`, consistent with the same permission model.
- [ ] 🟡 **Entitlements / paid-tier enforcement.** No Stripe/RevenueCat/IAP integration exists at
  all despite 3 marketed pricing tiers (Free/Individual/Family) with feature gates like
  "unlimited contacts," "journey history (90 days)," AI features. `MAX_CONTACTS = 10` is a single
  hardcoded constant with no tier awareness. Needs: a subscription provider (RevenueCat is the
  standard Expo-friendly choice), an entitlement field synced to the user doc via webhook, and
  server-side gating (Firestore rules or Cloud Functions) — not just client UI hiding buttons.
- [ ] 🟢 B2B/admin dashboard (schools, NHS, lone-worker programmes) — marketed on the site,
  doesn't exist in any form (no web admin surface at all).
- [ ] 🟢 AI features (anomaly detection, route risk scoring, voice SOS, predictive alerts,
  AI safety assistant) — fully marketed, fully unbuilt. Needs its own scoping pass; not a "small
  bit," treat as a separate roadmap once Phases 0–3 are done. Until scoped, consider softening the
  marketing copy so the site doesn't oversell current app capability.

## Phase 5 — Observability (currently blind in production)

- [ ] 🟡 Privacy-scrubbed crash/error reporting (Sentry or Crashlytics with PII scrubbing rules —
  no phone numbers/coordinates/tokens in breadcrumbs). Deliberately omitted so far to limit PII
  risk, but for a safety-critical app "blind in production" is its own risk.
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
