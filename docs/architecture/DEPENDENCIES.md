# Third-party dependencies

A dependency in a safety app is a promise that someone else will keep
maintaining the thing an emergency alert passes through. This is the gate it
has to clear first.

## Before adding anything

**1. Does the OS already do this?**

Ask before searching npm. Both platforms ship a great deal — sheets with
detents, blur materials, haptics, geofencing, scheduled notifications. A thin
Swift/Kotlin wrapper around a platform API is usually better than a library:
better performance, correct platform feel, accessibility for free, and nothing
to go stale. The repo already does this (`SOSTileService.kt`,
`SOSWidget.swift`), so the pattern costs nothing new to follow.

**2. Health check — all of these, not a vibe:**

| Check | Pass | Why it matters |
|---|---|---|
| Last publish | within ~3 months | A quiet package on a fast-moving RN/Expo base is a pin to an old SDK |
| Maintainers | **more than one** | Bus factor of one on a safety path is a single point of failure |
| Open issues | triaged, not accumulating | Tells you whether anyone is actually home |
| Native code | prefer none | Every native dep is a rebuild for everyone and a prebuild risk |
| Licence | MIT / Apache-2.0 | Anything copyleft needs a decision, not an install |
| Expo SDK | listed in `bundledNativeModules.json` | If Expo pins it, Expo tests it against our SDK |

**3. Version pinning — always `npx expo install`, never `npm install`.**

npm's `latest` is routinely several majors ahead of what our SDK supports.
Checked on 5 Oct 2026 against SDK 54:

| Package | npm latest | SDK 54 wants |
|---|---|---|
| `react-native-gesture-handler` | 3.3.0 | **~2.28.0** |
| `react-native-reanimated` | 4.7.1 | **~4.1.1** |
| `expo-blur` | 57.0.3 | **~15.0.8** |
| `expo-haptics` | 57.0.3 | **~15.0.8** |
| `lottie-react-native` | 7.5.0 | **~7.3.1** |

`npm install expo-blur` would have installed a version built for SDK 57 and
broken the build. `expo install` reads `bundledNativeModules.json` and picks the
version Expo actually tests against ours.

**4. Install native dependencies in one batch**, then rebuild once. Each one is
a prebuild + native build for every developer and CI job.

## Decisions on record

### `@gorhom/bottom-sheet` — rejected (5 Oct 2026)

Initially recommended for the Option 15 pull-up sheet, then rejected on the
checks above.

- **Single maintainer.** Bus factor of one on the core of Home's navigation.
- **Last publish 2026-05-09** — five months, while every other candidate shipped
  within the last month.
- **Pulls in two more native deps**, and v5 targets reanimated 3 while SDK 54 is
  on 4.1.

**Resolution: no module needed at all.** Applying check 1 — *does the OS already
do this, and do we already have it?* — turned up `react-native-screens`, which
is already a dependency (expo-router requires it), already pinned by SDK 54
(`~4.16.0`), and already implements exactly this with the platform's own sheet:

| Platform | Implementation |
|---|---|
| iOS | `UISheetPresentationController` with `.detents` — `ios/RNSScreen.mm` |
| Android | Material `BottomSheetBehavior` — `android/.../rnscreens/bottomsheet/*.kt` |

The options reach it through expo-router's forked native-stack:
`sheetAllowedDetents`, `sheetInitialDetentIndex`,
`sheetLargestUndimmedDetentIndex`, `sheetGrabberVisible`, `sheetCornerRadius`,
`sheetExpandsWhenScrolledToEdge`.

So the sheet costs **zero new dependencies and zero new native code**, and it is
still the real OS sheet. Our layer is one options object:
`src/navigation/sheetPresentation.ts`.

This is the gate paying for itself — the first instinct was a third-party
library, the second was writing Swift and Kotlin, and the right answer was
neither.

### `expo-firebase-recaptcha` + `expo-firebase-core` — removed (5 Oct 2026)

Found while the first iOS prebuild failed. `pod install` aborted on
`FirebaseCoreInternal`/`GoogleUtilities` module maps, and the first instinct was
to work around it with `use_modular_headers!`. Running the health check instead
showed the packages should not be there at all:

| Check | Result |
|---|---|
| Last publish | **2022-10-25** — four years |
| In SDK 54's `bundledNativeModules` | **No** — Expo neither ships nor tests them against our SDK |
| Version vs SDK era | `expo-firebase-core@6.0.0` against SDK 54's 15–17.x unimodules |
| Build impact | Broke `pod install` outright |

`expo-firebase-core` arrived transitively via `expo-firebase-recaptcha`, and
there was already an Android autolinking exclude for it — a previous workaround
for the same package. Both removed; the exclude went with them, and
`pod install` then succeeded with 277 pods and zero Firebase pods.

**What replaces the capability.** `expo-firebase-recaptcha` existed because
Firebase's JS SDK does phone auth through a `RecaptchaVerifier` that needs a
DOM — its React Native entry point does not export one. The modern answer is
`@react-native-firebase/auth` (26.4.0, published Sept 2026, Apache-2.0), which
verifies natively: silent APNs on iOS, Play Integrity on Android, and no
reCAPTCHA puzzle for the user at all.

That migration is deferred because it needs a Firebase project and
`GoogleService-Info.plist`, which do not exist yet. Until then the
`ApplicationVerifier` seam is kept and `FirebaseAuthProvider.sendOTP` throws a
message naming the exact next step — so this cannot become another subsystem
that is quietly dead while looking wired up.

### `@react-native-firebase/app` + `/messaging` — removed (5 Oct 2026)

Imported in **zero** source files. Push tokens come from `expo-notifications`'
`getDevicePushTokenAsync()`, which returns the native FCM/APNs token directly.
Their only footprint was a config plugin
(`withFirebaseMessagingManifestFix`) written solely to patch an Android
manifest conflict *they* caused. Package and plugin both removed.

Re-add `@react-native-firebase/messaging` only if background message handling
is needed that `expo-notifications` cannot do — and register its config plugin
properly at that point.

### `@bacons/apple-targets` — kept, upgrade pending (5 Oct 2026)

Passes the health gate: published 2026-07-17, MIT, and maintained by
`evanbacon` — Expo's lead engineer. Absent from `bundledNativeModules`, which is
expected and not a mark against it: this is a build-time config plugin, not a
native runtime module, so Expo has nothing to pin a version against.

The one real finding is a **version gap — we run 4.0.7, current is 5.0.0.**

4.0.7 crashes when it has to *update* an existing widget target rather than
create one:

```
Target "soswidget" already exists, updating instead of creating a new one
TypeError: withIosXcodeProjectBeta2BaseMod:
  Cannot read properties of undefined (reading 'removeFromProject')
    at applyXcodeChanges (with-xcode-changes.js:223)
```

`expo prebuild --clean` avoids it entirely by taking the create path, and since
`ios/` is generated and gitignored that is the normal workflow rather than a
workaround — `withPodMinimumDeploymentTarget` re-applies the pod fix on its own,
which is precisely why it is a plugin and not a hand-edited Podfile.

**Not upgraded now, deliberately.** A major bump can change the
`expo-target.config.json` schema, and doing that while a first device build is
still unverified would confuse two failure sources. Revisit once the widget is
actually being worked on — the target is only registered when `APPLE_TEAM_ID` is
set, so an incremental prebuild is only reachable on a machine that has one.

### Approved for Phase 1

| Package | Why it passes |
|---|---|
| `react-native-reanimated` | Software Mansion, releases weekly, in `bundledNativeModules` |
| `react-native-gesture-handler` | Same — and still needed for gestures outside the sheet |
| `expo-blur` | Expo first-party |
| `expo-haptics` | Expo first-party — installed in Phase 4 at `~15.0.8`, the version SDK 54 pins |
| `libphonenumber-js` | JS-only, no native surface, widely depended on |

`lottie-react-native` is **deferred to Phase 7** with the sign-in animation, and
re-checked then rather than now.

### `modules/nearby-places` — written, not installed (6 Oct 2026)

The gate's first question is "does the OS already do this?", and here it did.
Point-of-interest search was going to mean Google Places and a billed API key;
`MKLocalSearch` does the same search for free, with no account and no
per-request cost, on every iOS device.

No Expo package exposes it — `expo-location` wraps CLGeocoder, which does
addresses only — so this is a local Swift module under `modules/`, autolinked by
Expo. Apple-only by nature: `requireOptionalNativeModule` returns null on
Android, web and in Jest, and the provider falls back to fixtures there.

A dependency avoided rather than added, which is the outcome the gate exists for.

## Where native code belongs

Swift/Kotlin is the right answer when the platform already does the work
(sheets, blur, haptics, widgets), or when the JS runtime cannot be trusted to be
alive.

It is the **wrong** answer for safety decision logic. A native detector would
mean the same state machine written three times and kept in sync, and it still
dies with the battery. The thing that survives a dead phone is a server-side
deadline — see `escalateOverdueSafetyChecks` in `functions/src/safety/`.
