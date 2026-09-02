# HomeSafe

Personal safety app — journey tracking, one-tap SOS, smart check-ins, family status
sharing, and a discreet fake call. Built with Expo (React Native) and Firebase.

## Tech stack

- **App:** Expo Router, React Native, TypeScript
- **Backend:** Firebase (Auth via phone OTP, Firestore, Cloud Messaging, Cloud Functions)
- **Routing/maps:** OSRM (open-source routing); map rendering is not yet wired to a real
  provider — see `IMPLEMENTATION_PLAN.md`

## Architecture

Business logic is isolated from any specific SDK using a ports-and-adapters pattern:

```
app/                     Expo Router screens
src/models/               Plain data types + pure helper functions
src/providers/             Interfaces (e.g. AuthProvider, JourneyProvider, FamilyProvider)
src/implementations/       Concrete adapters — Firebase*, Expo*, and Mock* per provider
src/services/               Business logic, depends only on provider interfaces
src/context/                 React context wiring services into the component tree
src/hooks/                    Thin hooks over context
```

A screen never imports Firebase or an Expo SDK module directly — it goes through a
service, which depends on a provider interface. Swap `MockJourneyProvider` for
`FirebaseJourneyProvider` (see `src/context/AppProviders.tsx`) and nothing else changes.
This is also what makes the test suite fast: unit tests run against the `Mock*`
implementations with no network or emulator required.

`functions/` is a separate Cloud Functions project (its own `package.json` and
`tsconfig.json`) — it does not share imports with `src/`. Constants that must stay in
sync between the two (e.g. check-in grace period, retention windows) are duplicated with
an explicit comment pointing at the source of truth.

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Firebase project's config values
npm start               # expo start
npm run android          # or: npm run ios
```

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm run android` / `npm run ios` | Start and open on a device/simulator |
| `npm run type-check` | `tsc --noEmit` |
| `npm test` | Run the Jest suite (unit tests against `Mock*` providers; Firestore rules tests are emulator-gated and skip automatically if the emulator isn't running) |

## Firebase project setup

This repo doesn't commit a `.firebaserc` (it would pin a real project ID). Point the CLI
at your own project first:

```bash
firebase use --add
```

Then, from the repo root:

```bash
firebase emulators:start --only firestore   # local rules testing, no billing required
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes    # required — the scheduled functions below
                                              # use collection-group queries that need
                                              # the composite indexes in firestore.indexes.json
firebase deploy --only functions            # requires the Blaze (pay-as-you-go) plan —
                                              # Cloud Functions cannot deploy on Spark
```

Two scheduled Cloud Functions exist in `functions/src/index.ts` as a server-side backstop
to client-only logic that would otherwise silently fail to fire if the app is closed, the
phone is dead, or there's no signal:

- **`detectMissedCheckIns`** (every 2 min) — flags overdue check-ins the client never got
  a chance to report.
- **`enforceDataRetention`** (daily) — purges expired location trails and resolved SOS
  records per `DATA_RETENTION.md`, independent of whether anyone opens the app again.

## Project docs

- **`IMPLEMENTATION_PLAN.md`** — the live tracking doc for what's built, what's missing,
  and what's next, phased by priority (rules hardening → reliability → privacy/compliance
  → security → competitive parity → observability). Start here.
- **`SECURITY_REVIEW.md`** — auth boundary, Firestore rules invariants, local storage,
  and the open security gaps list.
- **`DATA_RETENTION.md`** — retention periods per data category and how each is enforced
  (client-triggered vs. scheduled server-side).

## Status

Pre-launch. Core safety features (journey tracking, SOS, check-ins, family sharing, fake
call) are implemented; monetization, AI features, and SMS fallback for contacts without
the app are not yet built. See `IMPLEMENTATION_PLAN.md` for the current punch list.
