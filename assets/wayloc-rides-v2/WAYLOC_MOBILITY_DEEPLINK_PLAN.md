# WayLoc — Ride hand-off (Uber / Ola / Rapido) plan for Claude Code

**Goal:** a user picks a destination in WayLoc and taps a ride provider. WayLoc opens that provider's app with the destination filled in where supported. When the user comes back, WayLoc asks **"Ride booked?"** and starts a Safe Journey.

Design reference: canvas "Simple home (15 options)" → **"Option 15 · Rides v2"**, boards `AP1`–`AP5` (these replace the v1 `AO1`–`AO4` boards). It reuses the Option 15 Safe Journey screens (`AI4`, `AI6`, dock, SOS).

> I could not see the WayLoc codebase from here. Steps that say "inspect" are for Claude Code to do first, in the repo, before writing code. The provider facts in section 2 come from the providers' public documentation as of Oct 2026 (sources at the end). Verify them again on real devices.

---

## 0. Rules for the whole feature (supersede anything below)

1. **The Safe Journey starts before WayLoc opens the ride app.** A deep link sends nothing back, so the hand-off is the only moment WayLoc can be sure of. The order is: start journey → then `openMobilityProvider`. A *pending mobility journey* is no longer needed to create the journey. Keep only `{ journeyId, provider, openedAt }`, so that on return WayLoc can show "Are you in the auto now?".
2. **Ride options only, never a price comparison.**
3. **Documented link formats only, one per provider. No guessed URLs.**
   - Uber: the universal link.
   - Ola: the app link, behind the partner token.
   - Rapido: none. Show it as "Book in Rapido yourself — no link yet", with no button.
   - Add **"I'll sort it myself"** (street auto, or someone else books).
4. **Provider names as plain text, with no logos** until each company gives written permission.
5. **Honest wording.** Use "Priya is getting an auto home" until she taps **Yes, I'm in**, and only then "Priya is in an auto". The guardian timeline shows "In the auto — shown when Priya confirms".

**Flow (canvas boards `AP1`–`AP5`):**

1. Route: travel mode, then an optional ride app.
2. **Start Safe Journey & open Uber**.
3. Back in WayLoc, the journey is already running in the *getting a ride* state: "Are you in the auto now?" with **Yes, I'm in** / **Still waiting** (reopens the app) / **Change travel**.
4. Confirmed: *in a ride*.
5. Guardian view with the honest timeline.

Journey ride state is `getting_ride` → `in_ride` → `arrived`. The `getting_ride` → `in_ride` change happens only when the traveller confirms.

## 1. Prerequisite: journeys that know the travel mode (build first)

- **Travel modes:** `walk · bus · bike · car` plus **`cab · auto · bikeTaxi`**. `bike` stays your own bicycle.
- **Route and ETA per mode:**
  - Rides use the **driving** route plus a **pickup allowance** (default 10 min), so "you're late" doesn't fire while someone waits at the kerb.
  - Travel mode is already stored on each journey; pass it to the routing connector.
  - ETA copy: "~10 min pickup + 14 min drive", then drive time only once `in_ride`.
- **Alert rules per mode:** rides get a longer "stopped" allowance (e.g. 20 min instead of 10) and a wider off-route tolerance. Walking rules stay unchanged.
- **Tracking rate per mode:** walking 30 s / 50 m. Rides use fewer points, e.g. a distance filter of ~200 m or 60 s. Tune on device.
- **Tests:** pure functions in `models/`, next to the existing `AlertRules` and `TrackingConfig` tests. Each mode should return the expected allowances, tolerances and tracking config, and the pickup allowance should only apply in `getting_ride`.

*(Exact numbers are suggestions; set them from real trip data.)*

---

## 1b. What changes from the original brief

Five corrections, based on what the providers actually document:

| Topic | Original brief | Correction |
|---|---|---|
| Uber | "Open app, else web/store" | Use Uber's **universal link** `https://m.uber.com/ul/?action=setPickup…`. It opens the Uber app if installed; otherwise iOS and Android go to the app store. No custom scheme, `canOpenURL` or Info.plist entry is needed for this path. Needs **`client_id`** from Uber's developer dashboard. |
| Ola | Pass pickup and destination | Ola documents an app link `olacabs://app/launch?…` and a universal link `https://olawebcdn.com/assets/ola-universal-link.html?…`. **`utm_source` is mandatory** and must be an **XAPP token issued by Ola**, which requires an Ola partner account. **Until we have the token, Ola stays behind a feature flag.** |
| Rapido | Deep link with destination | **Rapido publishes no public deep-link or URL-scheme documentation.** Do not invent `rapido://…`. Phase 1: open the Rapido app or store page with **no parameters**, and offer **"Copy destination"** so the user can paste the address. Revisit if Rapido provides a partner link. |
| Pickup | Send pickup coordinates | **Don't send the user's coordinates.** Uber supports `pickup=my_location`; Ola defaults pickup to the current location when `lat`/`lng` are omitted. Each provider then uses its own GPS. This is less data and better privacy. |
| Destination label | Send label | Send the **formatted street address or postcode** only. **Never send WayLoc nicknames** such as "Home", "Mum's house" or "School": they reveal personal information to a third party. |

---

## 2. Provider facts (from official docs)

### Uber — supported, documented

- **Universal link:** `https://m.uber.com/ul/?action=setPickup&client_id=<CLIENT_ID>&pickup=my_location&dropoff[latitude]=<lat>&dropoff[longitude]=<lng>&dropoff[formatted_address]=<urlencoded address>`
- `dropoff[nickname]` or `dropoff[formatted_address]` is needed for the drop-off to display.
- `product_id` only works when the pickup is set explicitly, so don't send it.
- If the app isn't installed, the link goes to the store (per Uber).
- `https://m.uber.com/?action=setPickup…` (without `/ul/`) always opens the browser. Use it only as a last-resort web fallback.
- There is **no booking callback**. Uber's FAQ also says deep links can't return price or time estimates.
- **Config:** `UBER_CLIENT_ID` in env/config, not in source.

### Ola — documented, but needs a partner token

- **App link:** `olacabs://app/launch?utm_source=<XAPP>&landing_page=bk&drop_lat=<lat>&drop_lng=<lng>&drop_address=<address>` (optionally `category=…`, `bk_act=rn`). If the app is missing, Ola redirects to the store.
- **Universal link:** `https://olawebcdn.com/assets/ola-universal-link.html?` with the same parameters. It opens the app if installed, otherwise the website. Per Ola, it works in a mobile browser, not a webview.
- **Web link (India only):** `https://book.olacabs.com/?…&drop_lat=…&drop_lng=…&drop_name=…&dsw=yes`
- **`utm_source` is mandatory** (the XAPP token from Ola). Ola's developer access is "case to case".
- **Config:** `OLA_XAPP_TOKEN`. If it's missing, `isEnabled()` returns false and Ola is hidden.

### Rapido — no public deep-link documentation found

| Item | Value |
|---|---|
| Android package | `com.rapido.passenger` |
| iOS App Store id | `1198464606` |
| Website | `https://www.rapido.bike` |

Phase 1 behaviour:

- **Android:** RN `Linking` can't launch an app by package name. Either:
  - (a) add a tiny native module `openPackage(packageName)` using `getLaunchIntentForPackage`, falling back to `market://details?id=…`; or
  - (b) open the Play Store page, whose "Open" button launches the app if installed.

  Pick (b) unless the team already has a native helper.
- **iOS:** open `https://apps.apple.com/app/id1198464606`. Its "Open" button launches the app if installed.
- Always show **Copy destination**, as a user-initiated clipboard write of the address only.

**Other app-store values** (verify against the store listings; Uber's id and both Uber/Ola packages are from memory, not the docs):

- Uber: iOS `id368677368`, Android `com.ubercab`
- Ola: iOS `id539179365`, Android `com.olacabs.customer`

---

## 3. Architecture (as briefed, adjusted)

```text
src/mobility/
  mobility.constants.ts              // provider ids, store ids/packages, TTLs, analytics event names
  mobilityProvider.types.ts          // MobilityProvider, RideRequest, OpenRideResult, PendingMobilityJourney
  providers/
    uberProvider.ts                  // universal link builder (documented)
    olaProvider.ts                   // app link + universal link, gated on OLA_XAPP_TOKEN
    rapidoProvider.ts                // store/app launch only; supportsDestinationPrefill = false
  mobilityProviderRegistry.ts        // getProvider(id), listEnabledProviders()
  mobilityDeepLinkService.ts         // openMobilityProvider({ provider, destination }) → OpenRideResult
  pendingMobilityJourney.service.ts  // save / get / clear, with TTL; uses the EXISTING storage wrapper
  useMobilityReturn.ts               // hook: AppState listener → shows "Ride booked?" when appropriate
  __tests__/…
docs/mobility-deep-links.md
```

**Provider interface (extended):**

```ts
export type MobilityProviderId = 'uber' | 'ola' | 'rapido';
export interface LatLng { latitude: number; longitude: number }
export interface RideDestination extends LatLng { address?: string }   // formatted address/postcode only – never a nickname
export interface RideRequest { destination: RideDestination }          // pickup omitted on purpose (provider uses current location)

export type OpenRideResult =
  | { status: 'opened_app' }
  | { status: 'opened_store' }     // added: app missing, went to the store
  | { status: 'opened_web' }
  | { status: 'not_available' }    // provider disabled/unsupported on this platform
  | { status: 'error'; code: 'invalid_destination' | 'open_failed' | 'busy' };

export interface MobilityProvider {
  id: MobilityProviderId;
  displayName: string;                         // "Uber"
  transportMode: 'cab' | 'auto' | 'bike';      // default for Safe Journey; Rapido → 'bike'
  supportsDestinationPrefill: boolean;         // Rapido: false → UI shows "enter destination there"
  isEnabled(): boolean;                        // config/feature flags (e.g. Ola token present)
  buildLaunchTargets(req: RideRequest): { primary: string; fallbacks: string[] }; // pure, unit-testable
}
```

**`openMobilityProvider` (service) does the following:**

1. Validate the destination: finite lat in −90…90, lng in −180…180, not (0,0). Otherwise return `invalid_destination`.
2. Guard against duplicate calls with an in-flight lock; a second call returns `busy`.
3. Save a pending journey **before** leaving the app (section 4).
4. Try `primary`, then each fallback, using `Linking.openURL` in try/catch. Use `canOpenURL` only for custom schemes (`olacabs://`).
5. Return a typed result, with no raw errors. The UI maps it to friendly copy, e.g. "Uber could not be opened. Please try again."
6. If nothing opened, clear the pending journey.

**Rule:** screens only call `openMobilityProvider` and read `provider.displayName` / `supportsDestinationPrefill`. They never build URLs.

---

## 4. Pending journey lifecycle

```ts
interface PendingMobilityJourney {
  journeyIntentId: string;          // uuid
  provider: MobilityProviderId;
  destination: { latitude: number; longitude: number; address?: string; placeId?: string };
  createdAt: number;                // epoch ms
  expectedReturnState: 'awaiting_confirmation';
  leftAppAt?: number;               // set when AppState → background after launch
  promptCount: number;              // to avoid nagging
}
```

**Storage:** reuse the app's existing persistence (MMKV / AsyncStorage wrapper / persisted store), under a single key `mobility.pending.v1`. Store **no guardian data, no pickup coordinates and no names**.

**TTL:** 2 hours. Anything older is discarded silently on read.

**When to show "Ride booked?":**

| Situation | Show the prompt? |
|---|---|
| A pending journey exists, `AppState` goes `background` and then back to `active` | Yes |
| Cold start (WayLoc was killed) and a pending journey is younger than the TTL | Yes, once Home is mounted |
| A pending journey exists but the app never went to background (iOS shows an "inactive" blip when `openURL` fails) | No |

**Actions:**

| Button | Effect |
|---|---|
| **Yes, start Safe Journey** | Call the **existing** Safe Journey start service with the saved destination, plus `{ transportMode, mobilityProvider, bookingSource: 'external_deep_link' }` **only if the domain model has, or can cleanly take, these fields**. Then clear the pending journey and navigate to On the way. |
| **Not yet — go back to Uber** | Reopen the same targets and keep the pending journey (`promptCount++`). |
| **Cancel** | Clear the pending journey. |

**AppState listener:** a single subscription in `useMobilityReturn`, mounted once near the app root. It removes itself on unmount, and does nothing when there is no pending journey.

---

## 5. Platform config (minimal)

**iOS (Info.plist):**

- Add `LSApplicationQueriesSchemes` with **`olacabs`** only. It's needed because we call `canOpenURL('olacabs://…')`.
- Uber uses an https universal link, so no scheme entry is needed.
- Rapido has no scheme.
- Inspect the existing plist first; merge, don't overwrite.

**Android (AndroidManifest.xml):** Android 11+ package visibility requires a `<queries>` block for `canOpenURL` on custom schemes.

```xml
<queries>
  <intent><action android:name="android.intent.action.VIEW"/><data android:scheme="olacabs"/></intent>
  <!-- only if the native openPackage helper is added for Rapido -->
  <package android:name="com.rapido.passenger"/>
</queries>
```

- No new permissions are needed.
- Don't touch WayLoc's own intent filters or deep-link handling.

---

## 6. UI (Option 15)

- **Route sheet** gets the section "How are you travelling?":
  - **Walk** → the normal Safe Journey
  - **BOOK A RIDE, THEN COME BACK** → provider rows from `listEnabledProviders()`
  - each row shows a loading state on tap and disables the other rows while one is opening
- **Opening sheet** ("Opening Uber…"): shown briefly; if the result is not `opened_*`, show a friendly error.
- **Ride booked?** sheet: dynamic provider name, with the destination card and the three actions.
- **On the way (ride):** the top card "In an Uber to NN2 8ET · booked outside WayLoc", an optional **Add car number** field (shared only with the circle), and the same safety dock.
- **Copy:** "Uber could not be opened. Please try again." / "Rapido doesn't let us pre-fill the destination — tap Copy destination and paste it in Rapido."

---

## 7. Privacy, logging, analytics

- URLs contain only the destination coordinates and the formatted address, plus provider IDs (`client_id`, `utm_source`).
- No guardian data, user ID or safety state goes into any URL.
- Log through the **existing logger** with an event name, provider and result status only. **No coordinates or addresses in production logs.**
- Analytics events: `mobility_provider_tap`, `mobility_open_result`, `mobility_return_prompt_shown`, `mobility_confirmed`, `mobility_cancelled`.

---

## 8. Tests (Jest + React Native Testing Library)

**Pure builders (Uber, Ola):**

- exact query parameters
- URL encoding of the address
- no pickup coordinates
- nickname never used

**Registry:**

- Ola hidden without a token
- `listEnabledProviders` order

**Service** (mock `Linking.canOpenURL` / `openURL`):

- `opened_app`
- falls through to a fallback, giving `opened_store` / `opened_web`
- all fail, giving `error: open_failed`
- invalid or missing coordinates, giving `invalid_destination`
- duplicate tap, giving `busy`
- the pending journey is saved before open and cleared on total failure

**Pending service:**

- save / restore / TTL expiry / clear
- corrupted JSON is ignored

**`useMobilityReturn`** (mock `AppState`):

- background → active shows the prompt
- active → active without a background does not
- cold start with a pending journey shows it
- the listener is removed on unmount

**Confirmation:**

- Yes calls the existing Safe Journey service with the destination and metadata, then clears
- Not yet reopens and keeps the pending journey
- Cancel clears

---

## 9. Implementation order (smallest clean path)

1. **Inspect** (report back before coding):
   - state/storage (Redux, Zustand or Context; MMKV or AsyncStorage)
   - logger
   - navigation and existing `Linking` handlers
   - Safe Journey service and model
   - Info.plist and AndroidManifest
   - env/config pattern
2. Types, constants and the three providers (pure builders) with tests.
3. Registry and service, with tests.
4. Pending service on the existing storage, with tests.
5. `useMobilityReturn` and the "Ride booked?" sheet, with tests.
6. Route-sheet provider rows and copy.
7. Safe Journey integration through the existing service.
8. iOS and Android config.
9. `docs/mobility-deep-links.md`.
10. Real-device QA (section 10).

## 10. Real-device QA checklist

Run each on **iPhone and Android**:

- Uber installed: Uber opens with the destination filled in.
- Uber missing: the store page opens.
- Ola, with the token and the app installed: Ola opens with the drop filled in.
- Ola without the app: the store or website opens.
- Ola without the token: Ola is not listed.
- Rapido installed / missing: the store page opens and its "Open" button works; Copy destination copies only the address.
- Return to WayLoc after booking: "Ride booked?" appears once.
- Kill WayLoc while in Uber, reopen within 2 hours: the prompt appears. After 2 hours: no prompt.
- Double-tap a provider: it opens only once.
- Airplane mode: a friendly error appears and the app doesn't crash.
- Production logs contain no coordinates.

## 11. Known limitations and phase 2

- **No booking confirmation from any provider.** The user confirms. Uber, Ola and Rapido don't call WayLoc back.
- ETA in a ride is WayLoc's own estimate from live GPS, not the provider's.
- **Phase 2:** partner APIs, where available, for ride status, driver and vehicle, and trip-sharing links. Ola's Ride Booking API and Uber's ride APIs are partner-gated, and Rapido requires a business partnership.

## Sources

- [Uber — Introduction to Deep Links](https://developer.uber.com/docs/deep-linking)
- [Uber — Deep links FAQ](https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/faq)
- [Ola — Deep Linking](https://developers.olacabs.com/docs/deep-linking)
- [Ola — Developer overview](https://developers.olacabs.com/docs/overview)
- [Ola — Cab booking API](https://developers.olacabs.com/docs/cab-booking)
- [Rapido — App Store listing (id1198464606)](https://apps.apple.com/app/id1198464606)
- [Rapido — Android package com.rapido.passenger (store mirror listing)](https://cafebazaar.ir/app/com.rapido.passenger)
