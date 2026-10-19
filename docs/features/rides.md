# Rides — cab, auto, bike taxi (India)

**Status (19 Oct 2026):** Phases 1–3 built and tested — mode-aware journeys,
ride state (AP3 / AP4), and the hand-off to Uber (and Ola, once Ola issues a
token). Phases 4–7 not built. Boards: `assets/wayloc-rides-v2/` (`AP1`–`AP5`), with the designer's
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
| 9 | AP3 "Mum & Alex see 'getting an auto' until you say yes"; AP4 "Shared only with Mum & Alex" | "Your Safe Journey is on while you wait"; "Kept with this journey · deleted with its trail" | Family cannot see ride details until Phase 4. The board's wording returns with it |
| 10 | AP3 "Still waiting ↗" | Not shown until Phase 3 | It reopens the ride app; with no app opened it would do nothing |
| 11 | AP3 / AP4 drop "Feeling uneasy?" | Kept | A safety control is never hidden to make room |
| 13 | AP1 "Uber" preselected | Nothing preselected; "I'll sort it myself" until an app is picked | Nothing about the journey leaves WayLoc unless the traveller chooses |
| 14 | Plan §2 opens the Rapido store page | Rapido is a line of advice, no button | The plan's own Rule 0.3 ("no button") supersedes §2; Copy address does the job |
| 15 | Plan §3 `canOpenURL` for `olacabs://`, plus `LSApplicationQueriesSchemes` / `<queries>` | `openURL` only; a refusal falls through to the next link | Opening a link needs no declared scheme; asking first would — a native change for an answer `openURL` already gives |
| 12 | — | "Copy address for a ride app" on AP3 | For Rapido, a street auto, or a friend booking. The street address only, never the place's name |

## States

`getting_ride` → `in_ride` → arrived. `getting_ride` → `in_ride` only when the
traveller confirms. "Change travel" switches mode or provider without ending
the journey.

## Phases

| # | Work | Size | Needs |
|---|---|---|---|
| 1 ✅ | **Mode-aware journeys** (built 19 Oct — `models/TravelModeProfile.ts`, `__tests__/travelModes.test.ts`; bus and bike times are distance estimates, labelled so on screen 04) — modes `cab · auto · bikeTaxi`; routing receives the mode (Apple driving routes for rides and Car); ETA "~10 min pickup + 14 min drive"; alert rules per mode (rides: 20 min stopped, wider off-route margin); tracking rate per mode; tests in `models/` | ~1 week | — (needed anyway: Bus / Bike / Car show walking ETAs today) |
| 2 ✅ | **Ride state + "I'll sort it myself"** (built 19 Oct — `models/Ride.ts`, `components/journey/Ride*`, `ChangeTravelSheet`, `__tests__/rides.test.ts`) — `ride: { provider, state, confirmedAt, vehicleNumber }`; AP3 / AP4 on the journey screen; "Still waiting?" never alerts family by itself; vehicle number: free text, upper-cased, ≤12 chars, deleted with the trail | 3–4 days | — |
| 3 ✅ | **Provider hand-off** (built 19 Oct — `providers/RideAppProvider.ts`, `implementations/rides/`, `services/RideHandoffService.ts`, `RideAppPicker`, `RideHandoffSheet`, `__tests__/rideHandoff.test.ts`) — ride port + Uber / Ola / Rapido adapters with pure link builders and exact-URL tests; AP1 list and AP2 sheet; a failed link keeps the journey in `getting_ride` | 3–4 days | `UBER_CLIENT_ID`; `OLA_XAPP_TOKEN` |
| 4 | **Mum's view (AP5)** — ride fields in the shared family status; a ride timeline on Watch live | 2–3 days | — |
| 5 | **Server** — rules for ride fields; "getting an auto home" journey-start wording; vehicle number in SOS alerts; retention | 1–2 days | — |
| 6 | **Native** — nothing left on iOS (`expo-clipboard` added in Phase 2; no schemes needed, departure 15). Android: check `openURL` to `olacabs://` on Android 11+ | 1 day | Rebuild |
| 7 | **Real devices** — the designer's QA list (§10), iPhone and **Android**, in India | — | Android phones |

## Decided 19 Oct

- **Copy destination:** `expo-clipboard` (see `DEPENDENCIES.md`).
- **On *Yes, I'm in*:** ask *Uber / Other* when WayLoc opened an app (stored as
  `ride.bookedWith`, separate from `ride.openedApp`); ask nothing for "I'll
  sort it myself". The app cannot tell which app the ride was booked in.

## Phase 2 as built

- `Journey.ride`: `{ state, openedApp, bookedWith, confirmedAt, vehicleNumber }`,
  set at start for Cab / Auto / Bike taxi. Saved before it is shown.
- AP3 card while `getting_ride`: *Yes, I'm in* · *Change travel* · Copy address.
  At the end of the pickup allowance it asks "Still waiting for your auto?" —
  on the traveller's phone only, never an alert.
- The ETA counts the drive from *Yes, I'm in* (not the end of the allowance).
- AP4 row once `in_ride`: optional vehicle number — upper-cased, letters,
  digits and spaces, ≤12 letters and digits; removed with the journey's trail.
- *Change travel* (AP3 card, and journey Options for any journey): a new mode
  without ending the journey; re-routes; a new ride mode waits afresh.
- Firestore rules do not yet validate `ride` (Phase 5).

## Phase 3 as built

- **AP1:** for a ride mode, "Book the auto with (optional)" lists the apps
  whose credential is set (`UBER_CLIENT_ID`, `OLA_XAPP_TOKEN` via
  `app.config.ts` extra), Rapido as advice, and "I'll sort it myself". The
  start button becomes "Start Safe Journey & open Uber".
- **Order:** the journey is created with `ride.openedApp = 'uber'`, then the
  journey screen shows AP2 ("Safe Journey started · Opening Uber now…", the
  pickup allowance, "Only your destination goes to Uber") and opens the link
  after 1.2 s.
- **Links:** Uber's universal link (`m.uber.com/ul`, `pickup=my_location`,
  drop-off coordinates and street address, brackets percent-encoded), then
  Uber's web booking. Ola's `olacabs://` app link, then its universal link.
  Exact URLs are tested.
- **Failure:** "Uber didn't open" with *Try again* / *I'll book another way*.
  The journey stays in `getting_ride`; giving up clears `openedApp`, so *Yes,
  I'm in* will not ask about an app that never came up.
- **Back in WayLoc:** AP3 adds *Still waiting ↗* (reopens the app) when one
  was opened, and *Yes, I'm in* asks "Uber / Other".
- Double taps open once (`busy`). Not yet checked on a device: that Uber
  accepts a test-environment Client ID.
