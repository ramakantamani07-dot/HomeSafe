# wayLoc architecture

**Pattern: Ports and Adapters (hexagonal), with a React presentation layer on top.**

The tell is the ratio: 24 ports in `src/providers/` against 47 adapters in
`src/implementations/` — roughly two adapters per port, because every port has a
`Mock*` and a real implementation. That swap is load-bearing: it is why the test
suite runs in ~2.7 s with no emulator, and why features can ship before their
third-party credentials exist.

---

## 1. Layers

| Directory | Role | May import |
|---|---|---|
| `src/models/` | Domain types and pure functions (`Journey`, `Place`, `haversineMeters`) | nothing outside `models/` |
| `src/providers/` | **Ports** — interfaces only | `models/` |
| `src/implementations/` | **Adapters** — `Firebase*`, `Mock*`, `Expo*`, `OSRM*`, `Google*` | its own port, `models/` |
| `src/services/` | Application logic, framework-free | `providers/`, `models/` |
| `src/context/` | React state, lifecycle, wiring | `services/`, `models/` |
| `src/hooks/` | Access layer for screens | `context/` |
| `src/components/` | Reusable UI | `hooks/`, `config/` |
| `app/` | Screens (expo-router file routes) | `hooks/`, `components/` |

Supporting: `src/config/` (theme, constants), `src/utils/` (pure helpers).

## 2. The dependency rule

Dependencies point **inward**, toward `models/`. Nothing in an inner layer knows
anything about an outer one.

Concretely, and enforced:

- `services/` and `models/` never import React.
- Screens never import `implementations/` or `services/` — they go through hooks.
- `providers/` never references a concrete adapter except in doc comments.
- Only the composition root knows adapters exist.

> These are checkable with grep. See `docs/architecture/ARCHITECTURE_DEBT.md`
> for the current audit and the known exceptions.

## 3. A vertical slice

Starting a journey, top to bottom:

```
app/(app)/review-journey.tsx        view
  └─ useJourney()                   hook      (5 lines, passthrough)
     └─ JourneyContext              context   (React state, auth, lifecycle)
        └─ JourneyService           service   (validation, "already active?" guard)
           └─ JourneyProvider       PORT      (interface)
              ├─ FirebaseJourneyProvider      ADAPTER (production)
              └─ MockJourneyProvider          ADAPTER (dev / tests)
```

## 4. Composition root

`src/context/AppProviders.tsx` is the single file allowed to name concrete
classes. It instantiates every adapter and service as a module singleton and
selects the implementation:

```ts
const devMode = !isFirebaseConfigured();
const journeyProvider = devMode
  ? new MockJourneyProvider()
  : new FirebaseJourneyProvider(firebaseApp!);
```

Some adapters key off their own credential rather than Firebase — places falls
back to fixtures when `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` is absent, so the
journey flow runs end to end without a Google Cloud project.

## 5. Naming

`Provider` is overloaded and it matters:

- `JourneyProvider` (in `src/providers/`) is a **port interface**.
- `JourneyStateProvider` (in `src/context/`) is a **React context provider**.

Named fresh, `src/providers/` would be `src/ports/`. Renaming it is a large,
low-value diff; the convention to follow is that anything in `src/providers/` is
an interface and anything ending `StateProvider` is React.

## 6. Server side

Cloud Functions (`functions/src/index.ts`) are a separate runtime with their own
`tsconfig` and Jest config. They are **not** part of the port/adapter graph — they
react to Firestore writes and hold credentials the client must never see.

The rule that matters: **a Firestore write is the interface.** The client writes a
document; a function reacts. For example, flipping a `safetyChecks` document to
`ESCALATED` is what alerts guardians — the client never calls a notification API
directly.

## 7. Rules for new work

1. New external dependency → a **port** in `src/providers/`, plus a `Mock*`
   adapter. Never call an SDK from a service, context, or screen.
2. Business rules and thresholds live in **services** (pure, testable), not in
   contexts or screens.
3. Contexts own **lifecycle** — subscriptions, timers, React state — and delegate
   decisions to services.
4. Screens read **hooks** only.
5. Secrets and credentials never reach the client bundle. If a third-party call
   needs a secret, it belongs in a Cloud Function and the app's adapter calls
   that function.
6. Anything with a credential gets a fixture-backed fallback so the feature stays
   runnable without it.
