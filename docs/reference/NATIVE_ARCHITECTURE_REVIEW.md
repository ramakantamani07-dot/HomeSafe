# wayLoc — Native vs. React Native Architecture Review

Investigation date: 2026-09-16. Review only — no code changes made as part of this document.

## Method

Inspected directly rather than assumed: `package.json` dependencies, `app.config.ts` (no
`ios/`/`android/` folders exist yet — this project has never been prebuilt locally, so
`app.config.ts` is the actual source of truth for what Info.plist/AndroidManifest will contain),
`src/implementations/location/ExpoLocationProvider.ts`, `src/services/LocationTrackingService.ts`,
`src/models/TrackingConfig.ts`, `src/context/JourneyContext.tsx`, `src/services/SOSService.ts`,
`src/implementations/notification/FirebaseNotificationProvider.ts`,
`src/services/FakeCallService.ts`, `app/(app)/fake-incoming-call.tsx`,
`src/implementations/permissions/ExpoPermissionProvider.ts`, `functions/src/index.ts`,
`firestore.rules`.

## Baseline facts

- No `ios/`/`android/` native folders exist in this repo.
- `package.json` has no `expo-task-manager`, no `expo-background-fetch`, no
  `@react-native-firebase/*`, no custom native modules of any kind.
- `app.config.ts` has no `UIBackgroundModes` and no `isIosBackgroundLocationEnabled` flag on the
  `expo-location` plugin config.

## 1. Journey Tracking

**Critical finding**: `ExpoLocationProvider.ts:21-23` does `require('expo-task-manager')` inside a
try/catch specifically to detect availability — but the package isn't installed at all
(confirmed via `package.json`). This means `_backgroundTaskDefined` is **always false**, and every
journey — regardless of `enableBackground` — silently runs on the foreground-only fallback
(`Location.watchPositionAsync`, `ExpoLocationProvider.ts:124-146`). This is not a rare edge case;
it is the only path that has ever executed. **Background journey tracking does not currently
exist**, even though `LocationTrackingService`/`TrackingConfig.ts` are correctly designed for it.

Second, independent gap: even with the package installed, `app.config.ts`'s `expo-location`
plugin config never sets `isIosBackgroundLocationEnabled: true`, so `UIBackgroundModes: ['location']`
would not be injected into Info.plist, and iOS would not deliver background updates regardless.

Third gap: no arrival detection anywhere. `JourneyContext.tsx` stores `destinationCoordinates` but
never compares it to `currentLocation`. No geofencing (`startGeofencingAsync`) is used anywhere in
the codebase. Ending a journey is entirely manual today.

**Reliability by scenario**:
- Foreground: works.
- Backgrounded / phone locked / OS suspends JS: broken — no background task registered.
- Temporary network loss: reasonably handled via `OfflineSyncService`, though location updates are
  documented as best-effort/evictable, not guaranteed.
- Permission changes mid-journey: not handled — no listener for a permission downgrade.
- Battery optimization (Android OEMs): not addressed — no exemption prompt.
- Android process termination: would be survivable *if* the foreground service (already correctly
  coded for in `ExpoLocationProvider.ts:106-110`) were actually registered — but it never is.
- iOS force-quit: **impossible to survive under any implementation, native or not** — an absolute
  platform restriction. Only mitigation is server-side "gone quiet" detection (the same pattern
  `detectMissedCheckIns` already establishes).
- Arrival detection: not implemented.

**Rating: Native module recommended — but not custom native code.** `expo-location` +
`expo-task-manager` already wrap the real native APIs (`CLLocationManager` on iOS,
`FusedLocationProviderClient` + a foreground `Service` on Android) and the JS integration is
*already written correctly* — the bug is an uninstalled dependency and a missing plugin flag, not
a missing native module.

Fix, in order:
1. `npx expo install expo-task-manager`
2. Add `isIosBackgroundLocationEnabled: true` to the `expo-location` plugin config
3. Confirm `expo-task-manager` is registered in `plugins` if its config plugin requires it
4. Replace manual arrival logic (there is none) with `Location.startGeofencingAsync`

Swift/Kotlin needed: **No**, unless on-device testing (never done — background tracking has never
been enabled) reveals `expo-task-manager` insufficient.

## 2. One-Tap SOS

Flow: `SOSButton` → `SOSService` → `FirebaseSOSProvider` writes Firestore doc
(`status: 'ACTIVE'`) → `onSOSTriggered` Cloud Function → FCM push to contacts.

**Confirmed bug** (found earlier this project, re-verified here):
`FirebaseNotificationProvider.getDeviceToken()` (`FirebaseNotificationProvider.ts:39-49`) calls
`Notifications.getDevicePushTokenAsync()`, which returns the **raw APNs token** on iOS, not an FCM
token. Firebase Admin's `messaging.send()` requires a real FCM token. No
`@react-native-firebase/messaging` exists to do the native APNs↔FCM exchange. **SOS push to/from
an iPhone will fail today.** Android is unaffected (real FCM token returned natively there).

Can sending fail if RN is suspended/offline/killed? The *trigger* (tapping the button) requires
the JS runtime alive — unfixable by definition, since you can't tap a UI that isn't running; the
real mitigation is a trigger that doesn't require opening the app at all (see below). The *send*
path (Firestore write → Cloud Function) is resilient to the client dying immediately after the
write succeeds; the only fragile window is between tap and write, where Firestore's own SDK-level
offline write queue applies (not `OfflineSyncService` — a separate, built-in mechanism).

**Rating: Native module recommended for trigger reliability, not for the send path** (which needs
a client/backend fix, not native code). A genuine native-module case: triggering SOS without
opening the app — a Lock Screen widget / Action Button (iOS, `AppIntents`/`WidgetKit`, Swift) or a
Quick Settings Tile (Android, `TileService`, Kotlin). Platform restriction: iOS reserves the
physical Emergency SOS gesture (power+volume) for its own system feature — third-party apps cannot
intercept it; a Control Center tile / Action Button / Lock Screen widget are the realistic
alternatives.

## 3. Smart Check-Ins

`CheckInService.confirmSafe()` computes the deadline client-side and writes `nextCheckInAt` to the
journey doc. **What is server-owned** (this project's Phase 1 work, verified against a real
Firestore emulator, 27/27 passing): the scheduled Cloud Function `detectMissedCheckIns` (every 2
min) independently queries for `status == 'ACTIVE' && nextCheckInAt <= now - grace - buffer` and
flips it itself — this does not depend on the client's `setInterval` at all. The critical-alert
path is **not** JS-timer-dependent, confirmed.

Gap: no Firestore rules validation on `nextCheckInAt`'s shape/bounds — a buggy/compromised client
could write an unreasonable deadline.

**Rating: React Native is sufficient — already correctly a backend/Firestore problem, largely
solved.** No native module involved. Swift/Kotlin needed: No.

## 4. Family Dashboard

Permission-filtered status computed at publish time (this project's Phase 0 fix), fanned out
per-connection via `firestore.rules`'s `sharedStatus` subcollection. No location coordinates are
ever included (`FamilyStatusSnapshot` has no lat/lng field). Purely Firestore + React state — no
continuously-running capability, so no backgrounding-related reliability question applies.

**Rating: Good as-is.** Swift/Kotlin needed: No.

## 5. Fake Call

`FakeCallService.schedule()` (`FakeCallService.ts:14-24`) is a plain `setTimeout`. The resulting UI
(`app/(app)/fake-incoming-call.tsx`) is a custom-built screen (`View`/`Text`/`TouchableOpacity`),
not the real system call UI. **This is the correct approach, not a compromise** — using CallKit
(iOS) or Telecom/ConnectionService (Android) purely to simulate a fake call would be functional
impersonation of a system-identity API, a real App Store/Play Store policy risk, not a technical
upgrade.

Actual gap: the `setTimeout` trigger is not reliable if the phone locks or the app backgrounds
before it fires — the same class of problem as the check-in timer, just with no backend involved
in this feature at all.

**Rating: React Native is sufficient but needs changes.** Fix: schedule a local notification via
`expo-notifications` (`scheduleNotificationAsync`, seconds trigger) instead of relying solely on
the in-memory timer — OS-scheduled, fires reliably even backgrounded/killed. Swift/Kotlin needed:
No — this is exactly the "mature library already solves it" case.

## 6. Privacy Controls

Permission display/requests, biometric toggle (`expo-local-authentication` — already the correct
native-backed library choice), delete-history/delete-account, both now backed server-side
(`enforceDataRetention`, `onUserAccountDeleted` Cloud Functions, this project's Phase 1 work).

**Rating: Good as-is.** Swift/Kotlin needed: No.

## 7. Trusted Contacts / Guardian Sharing

Pure CRUD + Firestore permission model. Confirmed again: contacts without the wayLoc app receive
nothing today (no SMS fallback, no web link) — a backend/product gap, not a native-mobile gap.

**Rating: React Native + backend is correct.** Swift/Kotlin needed: No.

---

## Architecture Proposal

**React Native (stays here)**: all UI/navigation, Smart Check-Ins logic, Family Dashboard, Privacy
Controls, Trusted Contacts, Fake Call screens (fix only the trigger mechanism), SOS button UI and
write-trigger, Journey Tracking's foreground behavior/UI/route display.

**Swift native module(s) — iOS**:
- `wayLocQuickSOS` — Lock Screen widget / Action Button SOS trigger without opening the app.
  APIs: `AppIntents`, `WidgetKit`.
- Not a new module, but a verification task: confirm `expo-task-manager` background delivery
  actually holds up on-device once enabled — this has never been tested, since it's never been on.

**Kotlin native module(s) — Android**:
- `wayLocQuickSOSTile` — Quick Settings Tile SOS trigger. APIs: `TileService`.
- Same verification task as above, plus OEM battery-manager testing (MIUI/OneUI/EMUI) once the
  foreground service is actually running.

**Deliberately not recommended**: custom native background-location module, custom native FCM
module, or CallKit/Telecom for fake call — in each case an already-available or easily-installed
mature library (`expo-task-manager`, `@react-native-firebase/messaging`, `expo-notifications`)
does the job; custom native code would just reimplement what those already do.

**Backend (Firebase)**: already source-of-truth for missed check-in detection, data retention, and
account deletion (verified this session). Must add: a delivery channel for SOS/alerts that doesn't
require the recipient to have the app (SMS or a web guardian link) — the single largest
safety-critical gap found across this entire review, bigger than any native-vs-RN question. Must
fix: the iOS APNs/FCM token bug, which belongs in `FirebaseNotificationProvider` (client) via
`@react-native-firebase/messaging`, not in Cloud Functions.

## Priority

**P0 — required before production**
1. ✅ **Done.** Installed `expo-task-manager`, added it to `app.config.ts`'s `plugins`, and set
   `isIosBackgroundLocationEnabled: true` **and** `isAndroidBackgroundLocationEnabled: true` on the
   `expo-location` plugin config (the review originally only named the iOS flag — Android needs its
   own equivalent, which also auto-enables the foreground-service permissions
   `ExpoLocationProvider.ts` already assumes exist). Verified for real: ran actual `expo prebuild`
   for both platforms and inspected the generated files directly — `ios/wayLoc/Info.plist` now
   has `UIBackgroundModes: [fetch, location]` and the correct
   `NSLocationAlwaysAndWhenInUseUsageDescription`; `android/app/src/main/AndroidManifest.xml` now
   has `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, and `FOREGROUND_SERVICE_LOCATION`. Native
   folders were deleted again afterward (verification only) — this project uses config-plugin-driven
   continuous native generation, not checked-in native folders; added `/ios/` and `/android/` to
   `.gitignore` since they weren't excluded before.
   **Separate blocker found and fixed along the way**: `assets/` was completely empty —
   `app.config.ts` references `icon.png`/`splash.png`/`adaptive-icon.png` that didn't exist, which
   made the very first prebuild attempt fail immediately. This would block *any* build, including
   the EAS cloud build already in flight. Generated placeholder assets (solid brand-blue `#2563EB`
   with a white "H" mark) so builds can proceed — these are explicitly placeholders, not final
   branding, and should be swapped for real design assets before public launch.
   On-device verification that background delivery actually survives real backgrounding is still
   outstanding — this fixes the configuration, but nobody has confirmed the behavior on a physical
   device yet, since it's never been turned on before now.
2. 🟡 **Blocked on a prerequisite you don't have yet — partially done.** Installed
   `@react-native-firebase/app` and `@react-native-firebase/messaging` (in `package.json`).
   Deliberately **not** registered in `app.config.ts`'s `plugins` yet, and
   `FirebaseNotificationProvider.ts` deliberately **not** changed yet either — verified directly
   that registering the plugins without a real `GoogleService-Info.plist`/`google-services.json`
   hard-fails `expo prebuild` immediately (`Path to GoogleService-Info.plist is not defined`),
   the same failure mode as the empty `assets/` folder. Changing the provider code now, before the
   native side can actually be configured, would also regress the currently-working Android path
   (which already gets a real FCM token today) for no benefit, while iOS stays broken either way —
   worse than leaving it as-is.

   **What's actually blocking this**: you don't have a real Firebase project yet (no `.firebaserc`
   — `demo-wayloc` is a throwaway local-only ID used only for emulator testing). Once one exists:
   1. In Firebase Console → Project Settings, add an iOS app (bundle ID `com.wayloc.app`) and an
      Android app (package `com.wayloc.app`) to the project.
   2. Download `GoogleService-Info.plist` and `google-services.json`, place them at the repo root
      (or wherever you prefer — the path just needs to match config).
   3. In `app.config.ts`, add `googleServicesFile: './GoogleService-Info.plist'` under `ios`, and
      `googleServicesFile: './google-services.json'` under `android`.
   4. Uncomment/add `'@react-native-firebase/app'` and `'@react-native-firebase/messaging'` to the
      `plugins` array (currently left out with a comment explaining exactly this).
   5. In `FirebaseNotificationProvider.ts`, replace the `getDeviceToken()` body's
      `Notifications.getDevicePushTokenAsync()` call with `messaging().getToken()` (import
      `messaging` from `@react-native-firebase/messaging`) — this returns a real FCM token on
      *both* platforms, since the native Firebase SDK does the APNs↔FCM exchange internally on
      iOS. Also swap `onTokenRefresh`'s `Notifications.addPushTokenListener` for
      `messaging().onTokenRefresh()`. Permission requests can stay on `expo-notifications` as-is —
      both APIs talk to the same underlying OS notification permission, no need to duplicate that.
   6. Re-run `expo prebuild` for both platforms and confirm it succeeds before trusting it.
3. ✅ **Done.** Learned along the way that the actual risk profile is narrower than first framed:
   the max configurable delay is 60 seconds (`DELAY_OPTIONS` in `src/models/FakeCall.ts`), and the
   app navigates to the countdown screen immediately on tap — so the JS timer is reliable for the
   common case (screen stays on, app stays foregrounded). The real risk is the screen auto-locking
   or the app backgrounding briefly during that short window, not a long unattended schedule.
   `FakeCallService.schedule()` now also schedules a matching local notification (cancelled if the
   JS timer fires normally, to avoid a redundant duplicate alert) as a backstop; a new effect in
   `FakeCallContext.tsx` handles the notification being tapped (both while the app is already
   running, and cold-started via `getLastNotificationResponseAsync`, with a staleness guard so an
   old tap can't resurface days later) and routes into the ringing screen. Also added
   `Notifications.setNotificationHandler()` in `app/_layout.tsx`, which didn't exist anywhere
   before — needed for this fix, and also fixes a related but previously-unnoticed gap: without it,
   real SOS/missed-check-in push alerts arriving while the app happens to be foregrounded may not
   have displayed anything at all. Added 4 new tests (`fakeCall.test.ts`) covering the notification
   scheduling/cancellation wiring specifically, since nothing previously exercised that path — full
   suite now 110 passed (up from 106), 19 still emulator-skipped.

**P1 — important improvement**
4. ✅ **Done.** Verified the exact `expo-location` geofencing API against the installed version's
   type definitions before writing against it (`startGeofencingAsync`/`stopGeofencingAsync`/
   `hasStartedGeofencingAsync`, `GeofencingEventType.Enter`, `LocationRegion` shape) rather than
   assuming. Added `startGeofencing`/`stopGeofencing` to `LocationProvider` (both
   `ExpoLocationProvider` — reusing the same `expo-task-manager` availability check as background
   tracking, sharing one `require('expo-task-manager')` — and `MockLocationProvider`, which
   simulates arrival after 15s so the confirmation UI is testable without a real device) and
   `LocationTrackingService`. `LocationTrackingContext` starts/stops a 150m geofence
   (`ARRIVAL_GEOFENCE_RADIUS_METERS`) around the journey's `destinationCoordinates` when one exists,
   and on arrival both sets `arrivalDetected` state *and* fires an immediate local notification
   (`trigger: null`) as a backstop in case the app is backgrounded when it fires. `active-journey.tsx`
   shows a confirmation banner — **deliberately never auto-ends the journey**; "I've arrived" always
   requires an explicit tap, consistent with the conservative, ask-first pattern already established
   for check-ins. No-op (not a failure) when a journey has no destination coordinates, same fallback
   philosophy as background tracking. Fixed a pre-existing inline `LocationProvider` mock in
   `batteryTracking.test.ts` that needed the two new interface methods to keep compiling.
5. ✅ **Done — and found a second independent bug while implementing it.**
   `ExpoLocationProvider.ensureBackgroundPermission()` only ever *checked* background location
   status (`getBackgroundPermissionsAsync`) — it never called `requestBackgroundPermissionsAsync()`.
   That means even after P0 #1's config fix, **a fresh install would never be prompted for
   "Always" access at all**, so background tracking could never engage on a new device regardless
   of the manifest/Info.plist being correct. Fixed to actually request when undetermined
   (`canAskAgain`), at journey start — matching Apple's just-in-time permission guidance, and
   consistent with iOS requiring foreground permission already granted before this upgrades it.
   For the downgrade detection itself: there's no push-based OS event for a silent Always→While-
   Using revocation (confirmed — `expo-location`'s permission APIs are pull-based only), so
   detection is reactive, on app-foreground resume (`LocationTrackingService.handleAppStateChange`,
   the same natural checkpoint already used to restart a stalled tracking session). Added
   `isUsingBackgroundMode()`/`hasBackgroundPermission()` to `LocationProvider`; the service tracks
   whether background mode actually engaged at start, and if it later reports non-background while
   that flag is still set, re-checks permission and fires `onBackgroundPermissionRevoked` if it's
   gone. `LocationTrackingContext` surfaces this as a dismissable warning banner (never silently
   swallowed) plus a backstop local notification for the backgrounded case. Also filled in the
   `locationBackground` field across `PermissionProvider`/`PrivacyService`/`PrivacyContext` — it
   was a hardcoded `'undetermined'` placeholder — and replaced the stale "Coming with Journey"
   card in `privacy.tsx` (journey tracking has existed in this codebase the whole time; that
   placeholder text was simply never updated) with a real status display.
   Added 3 tests for the detection logic; hit and fixed a real test-isolation gotcha along the way
   worth remembering — `AppState.addEventListener`'s jest mock is a **persistent** `jest.fn()`
   whose call history isn't reset between tests in the same file, so a naive `.find()` for "the"
   registered handler silently grabs a stale one from an earlier test once enough tests share the
   file; needs `.filter(...)` and take the last match instead. Full suite now 113 passed (up from
   110), 19 still emulator-skipped.
6. ✅ **Done.** Added `expo-intent-launcher` (official Expo module — confirmed its
   `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` action constant and exact API shape against the installed
   package before using it) and a "Battery Optimization" card on the Privacy & Security screen
   (Android-only) that fires the direct one-tap system exemption dialog via
   `Constants.expoConfig?.android?.package`. Declared the corresponding manifest permission in
   `app.config.ts` and verified it actually merges into a real generated `AndroidManifest.xml` via
   prebuild, not just assumed. No status *check* exists for this anywhere in the Android platform
   APIs available to Expo — only the request — so the button always fires the dialog rather than
   conditionally showing based on current state; that's a real platform limitation, not an
   oversight.
7. ✅ **Done, verified against the real emulator.** Added `isValidNextCheckIn()` to
   `firestore.rules`: on a `journeys` update, `nextCheckInAt` must be `null` or a timestamp within
   `[now, now + 65 min]` — bounded to the app's own longest real interval/extend option (60 min)
   plus a 5-minute buffer, closing the gap where a buggy or compromised client could write an
   arbitrary future value to suppress `detectMissedCheckIns` indefinitely. Added 4 new emulator
   tests (valid future value, clearing to null, rejecting a 2-hour value, rejecting a backdated
   value) plus a static check — ran the full suite against the real emulator (`npm run
   test:emulator`), all 137 passed. Timestamp arithmetic in rules (`request.time + duration.value(...)`)
   isn't something to trust from reasoning alone — worth having actually run it for real.
8. ✅ **Done — closed a connected visibility gap along the way.** Checked first, and confirmed:
   the check-in "prompt" phase was pure in-app state (`CheckInContext`'s countdown/modal) with
   **no notification at all** — invisible if the screen was locked or the app backgrounded during
   the grace period, the exact window this feature exists to cover, same class of gap as the Fake
   Call and arrival-detection fixes earlier in this phase. Registered a
   `expo-notifications` category (`wayloc.checkin-prompt`) with "I'm Safe" and "SOS" action
   buttons — verified the exact API shape (`NotificationAction`, `categoryIdentifier`,
   `isDestructive`, `opensAppToForeground` defaulting true, which matters: SOS needs the app to
   actually foreground so the response listener fires reliably) against the installed package
   before using it. Added `CheckInSOSNotificationBridge` in `app/_layout.tsx` — a headless
   component rendered inside `AppProviders` specifically because it needs both `useCheckIn()` and
   `useSOS()`, which live in separate contexts; fires the notification the moment the prompt phase
   begins, dismisses it once the phase moves on (confirmed or missed in-app), and routes the two
   actions to `confirmSafe()`/`triggerSOS()` on tap. Zero native code — this is exactly the
   `expo-notifications`-covers-it case the review flagged.
   **Known gap, not covered**: no test coverage for the bridge component itself — it's a React
   effect/hook composition, and this codebase has no component-testing library (`@testing-library/react-native`
   or similar) set up anywhere; adding one would be a bigger scope decision than this single item
   warranted. The underlying notification primitives it calls are the same ones already exercised
   via mocks in `fakeCall.test.ts`.

**All of Phase 1 (P1) is now done.**

**P2 — can wait**
9. 🟡 **Code written for both platforms; Android verified, iOS not yet device-tested.**

   **Shared design decision:** neither surface can call into this app's JS directly, so tapping
   either one opens the app at a new headless route, `app/(app)/sos-trigger.tsx`, which calls the
   existing `triggerSOS()` — the exact same call `home.tsx`'s SOS button makes. Deliberately
   rejected writing directly to Firestore from Swift/Kotlin instead: that would duplicate the SOS
   write shape (and its offline-queue fallback) in three languages forever, and a safety feature
   whose entire value is "always works" silently failing while offline from a widget would be
   worse than not having it.

   **Android — done, verified via a real prebuild.** First local Expo config plugin in this repo
   (`plugins/withSOSQuickSettingsTile.js`, using `@expo/config-plugins` directly — added as an
   explicit devDependency rather than relying on it transitively). `withDangerousMod` copies
   `plugins/android/SOSTileService.kt` into the generated `android/app/src/main/java/com/wayloc/app/`
   on every prebuild (native folders aren't committed — CNG); `withAndroidManifest` registers it as
   a `<service>` with the `BIND_QUICK_SETTINGS_TILE` permission and the QS_TILE intent-filter.
   `SOSTileService.onClick()` opens `wayloc:///sos-trigger` via `startActivityAndCollapse`,
   version-branched for the API 34+ `PendingIntent` overload vs. the older `Intent` overload.
   Verified end-to-end with `npx expo prebuild --platform android`: the Kotlin file lands next to
   `MainActivity.kt`, the manifest `<service>` entry is correct, and the icon drawable
   (`@drawable/notification_icon`, generated by `expo-notifications`' own plugin) exists at every
   density. No paid account needed for this half — buildable and testable on a real Android device
   now.

   **iOS — Swift written, config-plugin-verified via prebuild, NOT device-tested.** Uses
   `@bacons/apple-targets` (the real package — `expo-apple-targets` doesn't exist on npm) to
   scaffold the widget's Xcode target; pinned to **v4.0.7**, not the latest v5.0.0, since v5
   depends on `@expo/prebuild-config ~55.0.6` (Expo SDK 55) while this app is on SDK 54 — confirmed
   via `npm view` before installing, not assumed. New `targets/sos-widget/` (persistent, meant to
   be committed — unlike `ios/`, this is the actual source of truth per the plugin's own design)
   holds `expo-target.config.json` and `SOSWidget.swift`: a static `Link`-based `WidgetKit` widget
   (no `AppIntent`, no App Group — a plain deep-link `Link` needs neither), supporting the Lock
   Screen accessory families (`.accessoryCircular`, `.accessoryRectangular`) plus `.systemSmall` for
   easier testing once a device exists. Verified via `npx expo prebuild --platform ios`: the
   `sos_widget` target is fully linked into the generated `.xcodeproj` as an embedded Foundation
   Extension with the correct bundle ID (`com.wayloc.app.sos-widget`), and the plugin
   auto-generated `Info.plist`/`Assets.xcassets` into `targets/sos-widget/`. **What's still
   missing, and can't be done here:** `ios.appleTeamId` in `app.config.ts` (prebuild already warns
   it's absent), provisioning the widget's own bundle identifier in Apple Developer, and actually
   building + installing on a physical device to confirm it appears in the Lock Screen widget
   gallery and that the tap-to-open-app flow really works. A green prebuild proves the project
   *assembles* correctly — it proves nothing about whether the widget renders or behaves right on
   a real device.
10. 🟡 **Web-link half done and verified; SMS half deliberately not started (needs a Twilio
    account you don't have).** Built the no-app guardian tracking link:
    - `journeyShares` Firestore collection (owner-scoped, immutable, verified against the real
      emulator — 6 new tests, 143/143 passing) — the token is Firestore's own auto-generated
      document ID, not a hand-rolled UUID, so no new native crypto dependency was needed.
    - `getSharedJourney`, a new public HTTPS Cloud Function (`onRequest`, CORS-enabled) in the
      *existing* `functions/` project — deliberately not a new Firebase Admin integration inside
      `wayloc-web` itself, to avoid a second set of service-account credentials for what's fundamentally
      the same backend. It's the only path that ever resolves a token: anonymous clients never
      touch Firestore directly, and it's also the only place that checks whether the linked
      journey is still `ACTIVE` — a share document's mere existence never implies validity.
    - `JourneyService.createShareLink()` + a "Share Journey Link" button on the active-journey
      screen, using React Native's built-in `Share` API — no new package.
    - A new page in `wayloc-web` (`/track/[token]`, Server Component, `cache: 'no-store'`) —
      built, and its production build actually run and curl'd locally to confirm the unconfigured
      state (`TRACKING_FUNCTION_URL` unset, since no real Firebase project exists yet) renders
      "Tracking unavailable" gracefully rather than crashing.
    - **Deliberate v1 scope limit, not an oversight**: no live GPS coordinates on the public link —
      only status, destination, and ETA. Replicating the Family feature's full granular
      permission model for an anonymous audience is a much bigger security surface than this pass
      warranted; see `models/JourneyShare.ts`'s own comment.
    - Found and fixed an unrelated but real gotcha while adding `wayloc-web/.env.example`:
      that project's `.gitignore` blanket-ignores `.env*`, which was silently excluding
      `.env.example` too — added a `!.env.example` exception, or the file would never have
      reached git at all.
    - **Still needed from you** before this actually works end-to-end: a real Firebase project
      (same P0 #2 blocker), deploying `getSharedJourney`, and setting `TRACKING_FUNCTION_URL` in
      Vercel's environment variables for the `wayloc-web` project.
    - **SMS fallback not started** — needs a Twilio (or equivalent) account and phone number,
      which don't exist yet. The code structure (`sendAlerts()` in `functions/src/index.ts`) is
      already set up to add an SMS branch for contacts with no FCM token once those credentials
      exist; not scaffolded speculatively without them, same reasoning as the FCM/APNs item.
