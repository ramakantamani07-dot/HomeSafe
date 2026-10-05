# Architecture debt

Audit date: **2 Oct 2026**. Every item below was verified against the codebase,
not inferred. Each has the command that proves it, so the list can be re-run
rather than re-argued.

Scheduled for **Phase 0** of `docs/plan/IMPLEMENTATION_PHASES.md`.

**Phase 0: COMPLETE (5 Oct 2026).**

| Item | Status |
|---|---|
| D1 check-in subsystem | **done** — re-wired as a Settings preference; lock-screen actions now serve both prompts |
| D2 context memoisation | **done** — all 20; `listHistoryRef` workaround removed |
| D3 port breaches | **done** — zero remain |
| D4 duplicate `haversineMeters` | **done** |
| D5 hand-rolled timers | **done** — `useInterval`/`useTimeout` + 10 tests; contexts migrated |
| D6 provider nesting | deferred — memoisation removed the cost; revisit only if measured |
| D7 `home.tsx` size | **resolved** by Phase 2 — 881 → 394 lines |
| D8 battery unit confusion | **done** |
| D9 two colour palettes | **done** |
| D10 `functions/index.ts` monolith | **done** |
| D11 frozen escalation countdown | **done** (found en route) |

Two guards now enforce what the audit found, so none of it can regress silently:

```bash
npm run check:tokens   # no raw colour outside the design system
npm run check:arch     # layering, port discipline, context memoisation
npm run check          # both, plus types and the full suite
```

---

## D1 — The check-in subsystem is dead code, still billed, and took a safety feature with it

**Severity: high.** Live cost plus a lost safety capability.

Neither `startJourney` call site passes `checkInIntervalMinutes`, so it is always
`null` (`JourneyService` defaults it), so `CheckInContext`'s guard bails:

```ts
// src/context/CheckInContext.tsx:74
if (!userId || !journeyId || activeJourney?.status !== 'ACTIVE' || !intervalMinutes) {
```

```bash
# Expect: zero call sites passing a non-null interval
grep -rn "startJourney({" -A 7 app/ | grep checkInIntervalMinutes
```

Unreachable as a result: `CheckInContext`, `CheckInService`, `CheckInProvider`
and both adapters, `models/CheckIn.ts`, the `/checkIns` Firestore rules, and the
`enqueueCheckInCreate` / `enqueueMissedCheckIn` offline paths.

Two consequences that are not merely cosmetic:

1. **`detectMissedCheckIns` runs every 2 minutes in production**
   (`functions/src/index.ts:460`), scanning for a state the app can no longer
   produce. A scheduled function billed indefinitely for nothing.
2. **The lock-screen actions were lost.** The old bridge registered `"I'm Safe"` /
   `"SOS"` notification actions, answerable without unlocking. The replacement
   (`SafetyCheckContext`) schedules a notification with **no**
   `categoryIdentifier`, so it is a plain banner. During the 2-minute window
   before guardians are alerted, the traveller must now unlock, open the app and
   find the modal — strictly worse in the pocket/locked-screen case the feature
   exists for.

`CheckInSOSNotificationBridge` is still mounted in `app/_layout.tsx:181`, wired to
a phase that never fires.

**Fix:** move the actionable-notification category onto the safety check, then
delete the interval subsystem and its two Cloud Functions. Keeping two
half-live parallel systems is the worst of the three options.

---

## D2 — 20 of 21 context value objects are rebuilt every render

**Severity: high.** A latent bug generator, not a performance nit.

```bash
for f in src/context/*.tsx; do grep -q useMemo "$f" || echo "$f"; done
```

Only `JourneyDraftContext` memoises — because writing it triggered an infinite
render loop. It has already caused two real bugs:

- the loop above, and
- the Journeys tab refetching on every provider render, worked around with a
  `listHistoryRef` in `app/(app)/journeys.tsx` rather than fixed at the cause.

Every consumer receives unstable function identities, so any `useEffect` or
`useFocusEffect` depending on a context function is one provider render away from
looping or refetching.

**Fix:** `useMemo` the value and `useCallback` the functions in each provider;
delete the `listHistoryRef` workaround.

---

## D3 — Three breaches of port discipline

**Severity: medium.**

```
src/hooks/useCurrentPosition.ts  → imports locationProvider from AppProviders
src/hooks/useRoutePreview.ts     → imports routingService    from AppProviders
app/(app)/privacy.tsx            → imports journeyService    from AppProviders
```

These reach past the context layer into module singletons. A **screen** importing
a service directly is the worst of the three. Everything else is clean: zero
React in `services/`, zero `implementations/` imports from `app/`.

**Fix:** expose the capability through the owning context and consume via a hook.

---

## D4 — `haversineMeters` exists in three copies — ✅ FIXED

**Severity: low.** Resolved 5 Oct 2026: both duplicates now import from
`models/Place`, and a dead re-export in `GooglePlacesProvider` was removed.

```
src/models/Place.ts                              ← keep this one
src/services/RoutingService.ts
src/implementations/routing/MockRoutingProvider.ts
```

**Fix applied:** import from `models/Place`; the other two definitions are gone.
`grep -rn "function haversineMeters" src/` returns exactly one result.

---

## D5 — Timers and subscriptions are hand-rolled per site

**Severity: medium** given the battery and leak requirements.

```bash
grep -rln "setInterval\|setTimeout" src/context/
# CheckInContext, SafetyCheckContext, LocationTrackingContext, FakeCallContext, AuthContext
```

Each manages its own `clearInterval` in a cleanup. They are correct today, but
the pattern is copy-paste and one missed cleanup is a leaked timer that keeps the
JS thread awake.

**Fix (partially applied, 5 Oct 2026):** `src/hooks/useInterval.ts` and
`src/hooks/useTimeout.ts` now exist, with 10 tests in
`src/__tests__/timerHooks.test.tsx` covering the cases that matter — no timer
survives unmount, none is orphaned when the delay changes, and the callback can
be swapped without restarting the timer. `useInterval` also pauses while the app
is backgrounded, since a 1-second UI ticker firing behind a locked screen is
pure drain.

Still to do: migrate the five contexts to use them.

---

## D6 — `AppProviders` nests 15 providers

**Severity: low** once D2 lands.

A state change near the top of the pyramid re-renders the whole tree. Memoisation
(D2) removes most of the cost; flattening is optional afterwards.

---

## D7 — `app/(app)/home.tsx` is 881 lines — RESOLVED (5 Oct 2026)

> Phase 2 rewrote the screen for Option 15 and took it to **394 lines**,
> extracting `SearchRow`, `PlacesRow`, `CircleList` and `SearchResults`.
> `active-journey.tsx` got the same treatment in Phase 3 (694 → 578), with
> `TurnBanner`, `EtaCapsule` and `UneasyPill` lifted out.
>
> Kept below as the record of why size was treated as debt rather than style.

**Severity: low.** Four components plus their styles in one file. Split when next
touched — which Phase 2 will do anyway.

---

## Not debt — protect this

The hexagonal core is doing real work:

- 24 ports, 47 adapters, ~2:1
- zero React imports in `services/` or `models/`
- zero `implementations/` imports from screens
- the Mock/real swap is why tests run in 2.7 s with no emulator, and why Places
  shipped usable with no Google key

Do not trade this away for convenience. One acknowledged exception: `AuthContext`
and `FirebaseRecaptchaVerifier` both `import type { ApplicationVerifier } from
'firebase/auth'`. It is type-only, so there is no runtime coupling, and phone-auth
reCAPTCHA is genuinely awkward to abstract — a defensible exception rather than an
oversight.


---

## D8 — `batteryLevel` conflated a 0–1 fraction with a percentage — ✅ FIXED

**Severity: medium.** Found while memoising `BatteryContext` on 5 Oct 2026; not
in the original audit.

`expo-battery` reports charge as a **0–1 fraction**, and `LOW_BATTERY_THRESHOLD`
(`0.15`) compares against it in that unit. The context exposed it as
`batteryLevel: number` with no unit in the name, and two consumers read it as a
percentage:

- `app/(app)/active-journey.tsx` rendered **"Battery 0.64%"** instead of "64%".
  It also guarded on `batteryLevel !== null`, which is dead — the value is
  `number`, never null.
- `SafetyCheckContext` passed the fraction as `batteryPercent` into
  `escalate()`, so an escalated safety check stored `0.64` in a field named
  percent — and that value reaches **guardians** in the alert payload that the
  Cloud Function turns into push and SMS copy. A guardian deciding whether
  someone's phone is about to die would have been reading "0.64%".

`LowBatteryBanner` and the two family screens were correct (`* 100`), which is
why nothing looked obviously broken.

**Fix applied:** `BatteryContext` now exposes both units explicitly —
`batteryLevel` (0–1, for the tracking thresholds) and `batteryPercent` (0–100
integer, for display and for anything named "percent") — with the trap written
up in the interface doc comment. Both bad call sites now read `batteryPercent`.

**Lesson for new work:** a numeric value whose name doesn't carry its unit will
eventually be read in the wrong one. Name the unit, or expose both.


---

## D9 — Two colour palettes, and 94 literals outside both — ✅ FIXED

**Severity: medium.** Changing the app's colours meant editing 15+ files.

`src/config/constants.ts` held a `COLORS` object — a second palette, predating
the theme and still used by `MockMapProvider` — plus a dead `FONTS` block
superseded by the theme's. Outside both, screens carried **61 raw hex values and
33 `rgba()` literals**.

**Fix applied (5 Oct 2026):**

- `src/config/theme.ts` became `src/config/theme/`: `palette.ts` (the one file
  to edit for colour), `typography.ts`, `layout.ts`, `helpers.ts`, and an
  `index.ts` barrel so all 45 importers are untouched.
- `COLORS` and the dead `FONTS` deleted; `MockMapProvider` now uses the theme.
- Deliberately theme-independent UI moved to `FIXED_PALETTES` in `palette.ts` —
  the SOS screen and the fake-call screens opt out of theming on purpose, but
  their colours still live in the one colour file.
- Missing semantics became tokens rather than literals: `travelling`,
  `attention`, `ELEVATION.xs`, `ELEVATION.float`, `cardElevation(isDark)`.
- `npm run check:tokens` fails the build if a literal reappears.

---

## D10 — `functions/src/index.ts` was a 708-line monolith — ✅ FIXED

**Severity: medium**, rising to high once Phase 6 adds consent, SMS, CAMARA and
geofencing to the same file.

**Fix applied (5 Oct 2026):** split into feature modules with `index.ts` as
re-exports only.

```
functions/src/
├── index.ts      26 lines — re-exports only
├── shared/       firebase · types · messaging · batch
├── alerts/       onSOSTriggered · onMissedCheckIn · onSafetyCheckEscalated
├── checkins/     detectMissedCheckIns
├── retention/    enforceDataRetention · onUserAccountDeleted
└── sharing/      getSharedJourney
```

**The constraint that governed the split:** Firebase discovers functions by
*exported name*. Renaming an export tears down the old function and creates a
new one — downtime for a scheduled trigger, a changed URL for an HTTP one.
Verified by loading the compiled bundle and diffing its export list against the
original seven. `index.ts` documents this so the next person doesn't learn it
the hard way.

Phase 6's `network-location/` slots in as a sibling.


---

## D11 — The escalation countdown froze when the app was backgrounded — ✅ FIXED

**Severity: high.** The core safety promise failing silently. Found on 5 Oct
2026 while migrating `SafetyCheckContext` to `useInterval` (D5).

`secondsUntilEscalation` was a counter **decremented once per second**, and
guardians were alerted when it reached zero. A counter only advances while the
JS thread runs. Background the app — the single most likely thing to happen
with a phone in a pocket, which is precisely the scenario the safety check
exists for — and the countdown froze. Guardians were never told.

The in-app UI looked perfectly correct throughout, which is why it survived
review: with the screen open, the countdown behaved exactly as designed.

**Fix applied:** escalation now runs off an absolute deadline
(`escalateAtRef`), correct no matter how long the runtime slept. It is
re-evaluated on a one-second display tick, on every arriving location sample,
and immediately on return to the foreground. A failed escalation write leaves
the deadline in place so the next tick retries, rather than marking the check
escalated when nobody was told.

The same rewrite cut the detector's fixed 20-second poll: detection is now
driven by arriving location samples — the only thing that can change the answer
— with a 60-second safety net for "late", which becomes true through the
passage of time alone.

`CheckInContext` was audited at the same time and was already timestamp-based,
so it had no equivalent bug. Its one-second tick was nonetheless splitting
display from deadline: the display tick now pauses in the background, while a
coarse 15-second tick that does not pause keeps the transitions firing.

**The general lesson:** in a safety app, a countdown must be a deadline. Any
value derived by repeated subtraction is wrong the moment the runtime is
suspended, and it will look right in every test where the screen is open.
