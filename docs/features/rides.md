# Rides — cab, auto, bike taxi (India)

**Status (19 Oct 2026):** decided, not built. Phase 1 (mode-aware journeys)
started. Boards: `assets/wayloc-rides-v2/` (`AP1`–`AP5`), with the designer's
plan `WAYLOC_MOBILITY_DEEPLINK_PLAN.md`. This doc records where the build
follows that plan and where it deliberately does not.

WayLoc stays the safety layer around a journey. It is not a ride-hailing app:
it never books, prices or compares rides.

## Decisions

1. **The Safe Journey starts before WayLoc opens the ride app** (AP2). A deep
   link sends nothing back, so the hand-off is the one moment WayLoc can be sure
   of. On return the journey is already running in `getting_ride`.
2. **Ride options, never price comparison.** Uber's API terms forbid comparing
   its prices with other providers; "cheapest" is not what a safety app should
   push.
3. **Documented links only.** Uber: the universal link (needs `UBER_CLIENT_ID`,
   free). Ola: the app link behind the partner token (`OLA_XAPP_TOKEN`; hidden
   until Ola issues it). Rapido: no public deep link — "Book in Rapido
   yourself", with the destination to copy. Plus **"I'll sort it myself"**.
4. **Privacy.** No pickup coordinates (Uber `pickup=my_location`; Ola uses its
   own GPS). Only the **street address**, never a WayLoc nickname ("Home",
   "Mum's house").
5. **Provider names as plain text**, no logos until written permission.
6. **Honest wording.** "Priya is getting an auto home" until she taps *Yes, I'm
   in*; only then "Priya is in an auto".
7. **India only:** modes Cab, Auto, Bike taxi (plus Walk, Bus, Bike, Car);
   providers Uber, Ola, Rapido. Bike taxi is a travel mode only — WayLoc makes
   no claim that the service is permitted where the person is (state rules
   vary). Build and test **Auto** first.

## Where the build departs from the designer's plan

| # | Plan / board | Build | Why |
|---|---|---|---|
| 1 | §4 "pending journey", journey started on "Ride booked?" | No pending store: the journey starts first (their own Rule 0); the AP3 card shows whenever the journey is `getting_ride` | §4 contradicts Rule 0; this also survives a cold start with no extra state |
| 2 | AP5 "Walking to the pickup" | "Safe Journey started" | WayLoc does not know they are walking to a pickup (principle 4) |
| 3 | AP4 "booked with Uber" | "You opened Uber", or ask *Uber / Other* on *Yes, I'm in* | Opening Uber does not prove the ride is an Uber |
| 4 | AP3 pickup countdown, nothing at zero | At zero, "Still waiting for your auto?" on the traveller's phone only; the usual late check starts after allowance + 10 min | No silent end, no false "late" while waiting at the kerb |
| 5 | Vehicle number for the circle only | Also in SOS alerts during a ride | The most useful fact in a ride emergency |
| 6 | AP1 shows the walking route | Driving route for ride modes | Apple's driving directions are free |
| 7 | Separate `src/mobility/` tree | The app's layers: model, port, adapters, service, context, hook | CLAUDE.md: follow the architecture |
| 8 | AP2 "(Prototype: simulate return)" | Removed | Placeholder |

## States

`getting_ride` → `in_ride` → arrived. `getting_ride` → `in_ride` only when the
traveller confirms. "Change travel" switches mode or provider without ending
the journey.

## Phases

| # | Work | Size | Needs |
|---|---|---|---|
| 1 | **Mode-aware journeys** — modes `cab · auto · bikeTaxi`; routing receives the mode (Apple driving routes for rides and Car); ETA "~10 min pickup + 14 min drive"; alert rules per mode (rides: 20 min stopped, wider off-route margin); tracking rate per mode; tests in `models/` | ~1 week | — (needed anyway: Bus / Bike / Car show walking ETAs today) |
| 2 | **Ride state + "I'll sort it myself"** — `ride: { provider, state, confirmedAt, vehicleNumber }`; AP3 / AP4 on the journey screen; "Still waiting?" never alerts family by itself; vehicle number: free text, upper-cased, ≤12 chars, deleted with the trail | 3–4 days | — |
| 3 | **Provider hand-off** — ride port + Uber / Ola / Rapido adapters with pure link builders and exact-URL tests; AP1 list and AP2 sheet; a failed link keeps the journey in `getting_ride` | 3–4 days | `UBER_CLIENT_ID`; `OLA_XAPP_TOKEN` |
| 4 | **Mum's view (AP5)** — ride fields in the shared family status; a ride timeline on Watch live | 2–3 days | — |
| 5 | **Server** — rules for ride fields; "getting an auto home" journey-start wording; vehicle number in SOS alerts; retention | 1–2 days | — |
| 6 | **Native** — `olacabs` in `LSApplicationQueriesSchemes`; Android `<queries>`; `expo-clipboard` for Copy destination | 1 day | Rebuild |
| 7 | **Real devices** — the designer's QA list (§10), iPhone and **Android**, in India | — | Android phones |

## Open

- Copy destination: `expo-clipboard` (Expo-maintained, a native rebuild) or
  selectable text?
- On *Yes, I'm in*: ask *Uber / Other*, or say "you opened Uber"?
