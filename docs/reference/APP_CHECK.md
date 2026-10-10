# Firebase App Check

**Status (10 Oct 2026): server side built, app side not yet.** Tracked in
`SECURITY_REVIEW.md` §7 and the plan's "What is left".

| Part | State |
|---|---|
| Functions the app calls record App Check, and can refuse without it | **Built** — `functions/src/shared/appCheck.ts` |
| The app sends App Check tokens | Not yet — needs the Firebase iOS config file (below) |
| Firestore refuses requests without it | Not yet — a console switch, flipped last |

## Why this exists

Firestore Security Rules (`firestore.rules`) check *who* is making a request — is it
authenticated, does it own the document. They don't check *what* is making the request. The app's
Firebase config (API key, project ID, etc.) ships inside the app binary and isn't secret — anyone
can extract it and write a script that talks to Firestore/Cloud Functions directly, using a real
or freshly-created login, completely bypassing the app's UI. Concretely, that means someone could
script fake SOS triggers (each one costs a round of push notifications and pollutes real data),
run Find against basic-phone members (each one a billed operator lookup), or hit the database at a
volume no real user's phone would ever produce.

App Check closes this by requiring every request to carry a fresh attestation proving it came from
a genuine, untampered instance of the real app — verified via Apple's **App Attest** (iOS) or
Google's **Play Integrity API** (Android). Firestore and Cloud Functions can then be told to reject
any request that doesn't carry a valid one, regardless of how correct the login looks.

## Why order matters here specifically

Once a product (Firestore, Functions) is set to **Enforced**, it rejects *every* request lacking
valid attestation — including the real app, if anything is misconfigured. For a safety app, a
misconfiguration here doesn't just weaken security, it silently breaks SOS/journey tracking for
real users. Firebase's own recommended rollout exists specifically to avoid that failure mode, and
it's the one to follow rather than shortcutting straight to enforcement.

## What is built: the server side

Every function the app calls is declared with `appCallable` instead of `onCall`:
`locateMember`, `askMemberOk`, `lookupInvitee`, `sendTestAlert`, `resendConsentRequest`.

- **Monitor (the default).** Each request writes `metric:app_check` with `fn`, `mode` and
  `outcome` (`verified` or `missing`). Nothing is refused. The `missing` share is exactly what
  enforcing would refuse — see `OPERATIONS.md`.
- **Enforce.** `APP_CHECK_MODE=enforce` in `functions/.env`, then redeploy. Firebase refuses any
  request without a valid token before our code runs. Only the exact word `enforce` turns it on;
  a typo stays in monitor, because the failure mode of a wrong switch is every user losing Find.

**Deliberately not covered:** the three HTTP endpoints. `inboundConsentSms` and
`inboundMemberCall` are called by the SMS/voice providers, which cannot attest — they are guarded
by the provider's signature. `getSharedJourney` serves the public tracking page to anyone the
traveller shares the link with — it is guarded by the share token.

**Not yet used:** `consumeAppCheckToken` (replay protection, one token per request). Worth turning
on for `locateMember` once the app sends limited-use tokens, since each call is a billed lookup.

## Rollout plan — what is left

1. **Firebase console** *(you)*:
   - Project settings → Your apps → the iOS app (`com.ramasatish.wayLoc`) → download
     **`GoogleService-Info.plist`**. Keep it out of git (it is project config; the pre-commit
     hook blocks it).
   - App Check → register the iOS app with the **App Attest** provider (and Android with **Play
     Integrity** when there is an Android app). Leave every product **Unenforced**.
   - App Check → Apps → add a **debug token** for development builds; App Attest does not work in
     the Simulator or in debug builds without one.
2. **Native library in the app.** `@react-native-firebase/app` + `@react-native-firebase/app-check`
   (not the web `firebase/app-check`: App Attest and Play Integrity are native-only). Neither is
   installed yet — an earlier version of this doc said `app`/`messaging` already were; they are
   not. This is the same library real phone sign-in needs (the Firebase test plan's step 0), so do
   both in one native rebuild. It is not in Expo's `bundledNativeModules.json`, and on iOS it
   needs `expo-build-properties` → `useFrameworks: "static"`; check `react-native-maps` and the
   SOS widget target still build with that before committing to it.
3. **Bridge the token to the Firebase JS SDK.** The app talks to Firestore and Functions through
   the **JS SDK** (`firebase` package), which does not see the native App Check token on its own.
   Without this step the native library would attest and every request would still arrive without
   a token. In `src/config/firebase.ts`, after `initializeApp`:
   `initializeAppCheck(app, { provider: new CustomProvider({ getToken: <read the token from
   @react-native-firebase/app-check> }), isTokenAutoRefreshEnabled: true })`.
   Keep it behind a port (`AppCheckProvider`) with a mock, like every other native capability.
4. **Test on the iPhone** (debug token for Debug builds, App Attest for Release). Watch
   `metric:app_check` for the callables and the App Check page in the console for Firestore.
5. **Enforce one product at a time**, once `missing` stays near zero for a week of real use:
   Cloud Functions first (`APP_CHECK_MODE=enforce`, redeploy), then Firestore (console switch).
   Firestore last, because it carries SOS and journey tracking.
