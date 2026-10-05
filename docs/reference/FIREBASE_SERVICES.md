# Firebase Services — What's Used and Why

A reference for which Firebase products this app actually uses, which it deliberately doesn't, and
which are worth revisiting later. Written down so these decisions don't get re-litigated from
scratch in a future session — see `IMPLEMENTATION_PLAN.md` Phase 5 and `SECURITY_REVIEW.md` for
the related open items this feeds into.

## Actively used, in production code

- **Authentication** — phone number + OTP sign-in.
- **Cloud Firestore** — the main database (users, contacts, journeys, SOS events, family
  connections, invitations, journey share links), governed by `firestore.rules` and
  `firestore.indexes.json`.
- **Cloud Functions** — server-side logic: SOS/missed-check-in alerts, scheduled missed-check-in
  detection, scheduled data-retention purging, account-deletion sweep, the public journey-tracking
  web endpoint.
- **Cloud Messaging (FCM)** — push notifications, sent from Functions and received via
  `@react-native-firebase/messaging`.

Functionally: **Auth, Firestore, Functions, and FCM** are the four pillars this app runs on.

## Used for local dev/testing only

- **Firebase Local Emulator Suite** (Firestore emulator) — runs the security-rules test suite
  against a real emulator instead of mocks. Never touches a real project.

## Deliberately not used — correct as-is, not a gap

- **Firebase Storage** — no file uploads exist yet (profile photos are an explicit future item).
  Add only when that feature is actually built.
- **Firebase Hosting** — the marketing site already has its own deployment (Next.js on Vercel).
  Duplicating it into Firebase Hosting would just be two places to maintain the same thing.
- **Realtime Database** — Firestore's older, superseded predecessor. Every new Firebase project
  should use Firestore, which this app already uses exclusively; there's never a reason to run
  both side by side.
- **Dynamic Links** — Google **shut this service down entirely** (stopped working in 2025). Not a
  choice to revisit — it's not an available option anymore. The journey-share-link feature already
  uses a plain Cloud Function (`getSharedJourney`) plus the app's own `wayloc://` URL scheme
  instead, which turned out to be the right call independent of the shutdown.

## Provisioned but not integrated

- **Google Analytics** — being enabled in the Firebase console as part of initial project setup,
  but no Analytics SDK is wired into the app. Nothing is tracked until that's deliberately added
  later with a specific, privacy-reviewed event plan — enabling it in the console today does not
  by itself start collecting any data from the app.

## Worth adding later, not urgent

- **Remote Config** — lets you toggle features/values without an app-store release (e.g. a
  gradual premium-feature rollout, or a kill-switch for something misbehaving). No current need —
  nothing in the app does feature-flagging or A/B testing yet — but cheap to add whenever that
  need shows up.
- **Performance Monitoring** — automatic tracing of things like network latency and app start
  time. Worth calling out separately from Crashlytics/Analytics: it's lower privacy risk by nature
  (mostly technical timing data, not user content or crash context), which makes it a reasonable
  *first* step toward fixing "blind in production" (see `IMPLEMENTATION_PLAN.md` Phase 5) — it
  needs less privacy review than the other two before it's safe to turn on.

## The one real gap — plan it, don't rush it

- **Firebase Crashlytics** — tracked in `IMPLEMENTATION_PLAN.md` Phase 5 as the "blind in
  production" risk. Shouldn't be added carelessly — crash reports can easily leak phone numbers,
  coordinates, or auth tokens in breadcrumbs if the scrubbing rules aren't written deliberately —
  but it also shouldn't be forgotten indefinitely: once there are real users, not knowing about
  crashes is a real cost. Treat this the same way as `APP_CHECK.md` — worth its own short written
  plan (specifically, what gets scrubbed before anything ships) once there are real users worth
  monitoring, rather than bolting it on reactively after an incident.
