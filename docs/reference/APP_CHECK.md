# Firebase App Check — Setup Plan

Status: **not implemented**. Tracked as an open item in `SECURITY_REVIEW.md`'s cross-cutting
concerns table. This doc exists so the reasoning and rollout plan aren't lost between sessions —
see that file for where this fits alongside the project's other open security items.

## Why this exists

Firestore Security Rules (`firestore.rules`) check *who* is making a request — is it
authenticated, does it own the document. They don't check *what* is making the request. The app's
Firebase config (API key, project ID, etc.) ships inside the app binary and isn't secret — anyone
can extract it and write a script that talks to Firestore/Cloud Functions directly, using a real
or freshly-created login, completely bypassing the app's UI. Concretely, that means someone could
script fake SOS triggers (each one costs a round of push notifications and pollutes real data) or
hit the database at a volume no real user's phone would ever produce.

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

## Rollout plan

1. **Add the App Check SDK to the client.** Use `@react-native-firebase/app-check`, not the plain
   web `firebase/app-check` JS SDK — this app already committed to the React Native Firebase
   native-module path for anything needing real native platform integration (that's why
   `@react-native-firebase/app`/`messaging` exist, to fix the iOS APNs/FCM token mismatch — see
   `NATIVE_ARCHITECTURE_REVIEW.md` P0 #2), and App Attest/Play Integrity are native-only APIs with
   no meaningful web equivalent. This step is safe/additive and doesn't require a live project to
   write — but wiring it in productively still wants a real Firebase project to point at.
2. **Enable App Check for the project in the Firebase Console**, registering the iOS app (App
   Attest provider) and Android app (Play Integrity provider) — but leave enforcement **off**
   ("Unenforced" / monitoring-only mode). This starts collecting pass/fail data without blocking
   anything.
3. **Test on real devices.** App Attest does not work in the iOS Simulator; Play Integrity needs a
   real Android device too. This needs an actual build (EAS dev client or a real device build), not
   just `expo start`.
4. **Watch the App Check metrics in the console** for a period to confirm real app traffic is
   validating cleanly before touching enforcement.
5. **Flip to Enforced one product at a time** — Firestore first, then Cloud Functions — not all at
   once, so a problem in one surface doesn't take down everything simultaneously.

## Current blockers

- No real Firebase project yet (in progress separately — this doc's plan assumes one exists).
- No real device available to this session to validate App Attest/Play Integrity — same category
  of blocker as the Apple Developer Program enrollment and the Google Maps API key: something only
  the user can do on their own hardware/accounts, not something verifiable from here.

## Next step, once unblocked

Come back to this once the Firebase project is live and the app is running against it for real —
add the client SDK, register both platforms in Console with enforcement off, then work through
steps 3–5 above with real devices before enabling enforcement.
