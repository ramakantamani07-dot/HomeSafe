# Running wayLoc

## Right now: mock data on a real iPhone

The app runs end to end with **no backend and no credentials**. Every port has a
`Mock*` adapter (see `docs/architecture/ARCHITECTURE.md`), so journeys, places,
family, SOS and safety checks all work against in-memory data.

```bash
npm install
npx expo run:ios --device        # pick your iPhone when prompted
```

`react-native-maps`, `expo-task-manager` and background notifications are native
modules, so Expo Go will not work — this needs a dev client, which
`expo run:ios` builds. With the Apple Developer account active, signing is
handled by Xcode's automatic provisioning.

On launch the console prints which backend is live:

```
wayLoc data source: MOCK (in-memory) — mode "auto"
```

### If the device build fails

Four things actually blocked the first device build. All are one-time.

**"Failed to retrieve development teams"** in Xcode → Settings → Apple Accounts.
Not a network fault — `developer.apple.com` returning 200 proves nothing here.
Sign in at developer.apple.com → Account and accept any pending **Program
License Agreement**; Apple's API returns *no teams at all* while one is
outstanding, which is why not even the free Personal Team appears. Then remove
and re-add the account in Xcode. Once a team is visible, `-allowProvisioningUpdates`
creates the certificate and profile by itself — nothing to do by hand.

**"The app identifier … cannot be registered to your development team because it
is not available."** Apple's identifier namespace is global, not per-team, so a
generic id is already someone else's. Set `APP_BUNDLE_ID` (see `.env.example`) or
change the default in `app.config.ts` — **one** constant drives iOS and Android,
and the SOS widget derives `<id>.sos-widget` from it automatically. Then
regenerate; the id lives in the pbxproj, so editing `app.config.ts` alone is not
enough.

**Always regenerate with `--clean`:**

```bash
npx expo prebuild --clean -p ios
```

`@bacons/apple-targets` 4.0.7 crashes updating an existing widget target
(`Cannot read properties of undefined (reading 'removeFromProject')`) and only
works on the create path — see `docs/architecture/DEPENDENCIES.md`. `ios/` is
generated and gitignored, so this costs a pod install and nothing else;
`withPodMinimumDeploymentTarget` re-applies the iOS 15 floor on its own, which is
why that fix is a config plugin rather than a hand-edited Podfile.

**`expo run:ios` can't find Simulator.app.** A broken Xcode install, not a
project fault. Build straight to the device instead:

```bash
cd ios && xcodebuild -workspace wayLoc.xcworkspace -scheme wayLoc \
  -configuration Debug -destination 'id=<device-udid>' \
  -derivedDataPath build -allowProvisioningUpdates build

xcrun devicectl device info list                     # find the udid
xcrun devicectl device install app --device <udid> \
  build/Build/Products/Debug-iphoneos/wayLoc.app
npx expo start --dev-client                          # then launch from the phone
```

Check the result with `grep -E "BUILD SUCCEEDED|BUILD FAILED"` on the log —
piping `xcodebuild` into `tail` discards its exit code, so a failed build still
reports exit 0.

### What mock mode gives you

| Area | Mock behaviour |
|---|---|
| Auth | Any phone number, any OTP code |
| Places | Fixture results — try `riverside`, `SE15 4AB`, `school` |
| Saved places | Seeded Home, Work, and an address-less School (exercises "+ Add address") |
| Journeys, SOS, safety checks | In-memory, reset on reload |
| Maps | Real Apple Maps on iOS |
| Routing | Synthetic straight-line route with a realistic road factor |

## Later: switching to real data

The switch is one file: `.env`. Nothing in the codebase changes.

1. Copy `.env.example` to `.env`.
2. Fill in the six `FIREBASE_*` values from the Firebase console.
3. Rebuild — `app.config.ts` reads them at build time, so a Metro reload is not
   enough.

`EXPO_PUBLIC_DATA_SOURCE` controls the behaviour:

| Mode | Behaviour |
|---|---|
| `auto` (default) | Real when all four required Firebase values are present; mock otherwise |
| `mock` | Always mock, even with credentials present — for demos and testing |
| `real` | Always real; **throws at startup** if credentials are missing |

**Set `real` before any release build.** Under `auto`, a typo in `.env` silently
falls back to mocks — the app looks completely healthy while writing to an
in-memory map. `real` turns that into a loud failure instead of a shipped one.

### Switching incrementally

The Firebase flip is all-or-nothing by design: one project, one set of
credentials. Two capabilities switch independently of it, so they can be
adopted one at a time:

- **Places** keys off `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` — add it to get real
  address search while everything else stays on mocks.
- **Routing** keys off `EXPO_PUBLIC_OSRM_BASE_URL`.

### Before the first real run

Firebase also needs its server side deployed, or the app will authenticate and
then fail on reads:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes
npm --prefix functions run deploy
```

`GoogleService-Info.plist` / `google-services.json` are also required before the
`@react-native-firebase` config plugins can be registered in `app.config.ts` —
see `docs/reference/NATIVE_ARCHITECTURE_REVIEW.md` P0 #2.

## Checks

```bash
npx tsc --noEmit                 # app types
npm --prefix functions run build # Cloud Functions types
npm test                         # 188 unit tests, no emulator needed
npm run check:tokens             # no raw colours outside the design system

# Firestore rules tests need the emulator:
npx firebase emulators:exec --project=demo-wayloc --only firestore \
  "npx jest --selectProjects rules"
```
