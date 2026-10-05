# wayLoc — phased implementation plan

Covers the two new specifications and the architecture debt they will otherwise
compound.

| Input | Location |
|---|---|
| Option 15 UI redesign | `docs/features/option15-ui-spec.md` |
| Network location (basic-phone members) | `docs/features/network-location-spec.md` |
| Design mockups | `assets/imgs/*.png` |
| Current flow (built) | `docs/features/journey-flow-spec.md` |
| Current palette (built) | `docs/features/design-handoff.md` |
| Known debt | `docs/architecture/ARCHITECTURE_DEBT.md` |
| Layering rules | `docs/architecture/ARCHITECTURE.md` |

---

## Status at 5 Oct 2026

| Phase | State | What is left |
|---|---|---|
| 0 · Stabilise | **Done** | D6/D7 were folded into Phases 2–3, which rewrote those screens |
| 1 · Design system | **Done** | — |
| 2 · Home as map + sheet | **Done** | — |
| 3 · Journey | **Done bar one item** | "Open places on the way" — see D4 below |
| 4 · Safety | **Started** | `AI5` has 2 of 4 tiles; SOS tiers, uneasy boost, emergency number untouched |
| 5 · Settings | Not started | |
| 6 · Network location | Not started | G3 still open |
| 7 · Sign-in v6 | Not started | `AH1`–`AH4` boards never shared |
| 8 · Hardening | Not started | |

`AI5` was started early and deliberately: `AI4`'s "Feeling uneasy?" pill needs a
destination, and a button that goes nowhere is worse than no button. It ships
the two tiles the app can already do honestly — **Call guardian** and **Fake
call** — and simply omits the other two rather than rendering them inert.

### Known gaps, none of them blocking

| Gap | Where | Note |
|---|---|---|
| Emergency number hard-coded `999` | `app/(app)/sos.tsx` | Phase 4 requires market config — India is 112 |
| Notification icon is the full-colour logo | `app.config.ts` | Android needs a monochrome silhouette or it renders a white blob |
| `BiometricGate` still uses shield + wordmark | `src/components/security/` | Everything else now uses the real logo |
| `otp.tsx` has no brand lockup | `app/(auth)/` | Decide whether branding carries through the flow |
| Support email is `hello@homesafeapp.com` | Terms, Privacy | Survived the rename — the domain is a real-world decision, not ours to invent |
| EAS slug still registered as `homesafe` | expo.dev | Rename the project before the first EAS build or it rejects the slug |
| Wordmark unreadable at icon size | `assets/icon.png` | ~8 px on a home screen; the symbol alone would read better |

---

## Decisions settled 5 Oct 2026

### D1 · The map is not a data source — RESOLVED

`AppProviders` chose `MockMapProvider` whenever `devMode` was on, which tied the
map to whether *Firebase credentials* existed. They are unrelated:
`PROVIDER_DEFAULT` is Apple Maps on iOS, free and keyless, so a mock-data run was
hiding the real map on precisely the builds where it works.

Selection now keys on whether the **native module** can load
(`Constants.executionEnvironment`), because that is the actual constraint —
`react-native-maps` has no JS fallback and cannot render in Expo Go. Mock data is
free to mean only "mock data".

### D2 · Address search has three tiers, not two — RESOLVED

Without a Google Places key, search fell back to six London fixtures, so a real
postcode found nothing. The OS ships a geocoder — CLGeocoder on iOS — that
resolves addresses and postcodes for free.

```
Google key set        → GooglePlacesProvider        (POI autocomplete)
native module present → PlatformGeocoderPlaces…     (real addresses, free)
otherwise             → MockPlacesProvider          (fixtures)
```

The OS geocoder does **addresses, not points of interest**: it will find
`NN2 8ET` but not "coffee shops near me". That is a capability gap against
Google, not a defect, and the port makes the swap a one-line change.

### D3 · The turn banner has no arrow — RESOLVED

`AI4` §D draws a direction arrow. `RouteStep` deliberately carries no manoeuvre,
bearing or lane data — its own comment states that wayLoc is not a navigation
app — so an arrow would be **invented**, which §1 principle 4 forbids.

The banner names the road and the distance left, from a new pure `currentLeg()`
(`src/models/RouteResult.ts`, 3 tests). Real turn-by-turn would mean extending
`RoutingProvider` with manoeuvre data: a product decision, not a bug fix.

### D4 · "Open places on the way" — use Apple, and never say "open"

Checked against the iOS 27 SDK directly. `MKLocalSearch` gives free, keyless POI
search with exactly the categories that matter — `Police`, `Hospital`,
`FireStation`, `Pharmacy`, `GasStation`, `Hotel`. But `MKMapItem`'s entire public
surface is `identifier · location · address · name · phoneNumber · url ·
timeZone · pointOfInterestCategory`. **There are no opening hours at any iOS
version.** Google Places has `opening_hours` and `business_status`; that, not the
search, is the real difference.

So: search Apple, and restrict the safety path to categories that are
**inherently 24/7**. Drop cafés and shops, where "open" is both unverifiable and
the whole point. Never render an "Open now" badge we cannot stand behind.

Needs a small Swift module behind the existing `PlacesProvider` port — no Expo
package exposes `MKLocalSearch`. Scheduled with `AI5`'s "Nearest open" in Phase 4,
since that is where it is consumed.

### D5 · Ending a journey early still shows `AI6` — RESOLVED

`AI4`'s End previously called `cancelJourney()` and dropped the user on Home. Per
§D it now goes to `AI6` with an `endedEarly` flag, and that screen reads
"Journey ended" rather than congratulating someone on arriving somewhere they
chose not to reach. A journey that stopped early still happened, and the walk
feedback is still worth asking for.

### D6 · App identity — RESOLVED

`HomeSafe` → **wayLoc** across 56 files. Bundle id `com.ramasatish.wayLoc`
(`com.homesafe.app` was already registered to another developer account —
Apple's namespace is global). One `BUNDLE_ID` constant drives both platforms,
overridable by `APP_BUNDLE_ID`. Launch and icon-background colours now import
from `palette.ts` instead of a pasted hex, so app chrome obeys the same
one-file colour rule as the UI.

---

## 0. Read this first — decisions that gate the work

> **Decisions G1, G2, Phase 0.1 and Phase 3's open-places scope were settled on
> 2 Oct 2026.** They are recorded as resolved below. Only **G3** (commercial
> agreements) remains open.

### G1 · Design source — RESOLVED: Option 15 supersedes

`design-handoff.md` (30 Sep) is implemented today: warm-neutral paper `#F4F3EE`,
ink `#16181D`, teal `#0B6B5A`, four-tab bar, search as its own route.

`option15-ui-spec.md` (2 Oct) replaces it: map-land `#F2EFE9`, iOS blue
`#0A84FF`, success green `#34C759`, **no tab bar**, full-screen map with a
pull-up sheet, search *inside* the sheet.

**Option 15 wins.** Phases 1–5 re-theme and re-shell the app accordingly.
`design-handoff.md` moves to historical reference; its palette is replaced
wholesale rather than blended, so there is one source of colour truth.

Consequences to carry through: every `theme.ts` token changes value, the tab
navigator is removed, and `where-to.tsx` stops being a route. The journey
services, models, ports and Cloud Functions underneath are untouched.

### G2 · Seven native dependencies are missing — RESOLVED: use the sheet library

None of these are installed or transitively present. Each needs a native rebuild,
and most of Option 15's visual language depends on them:

| Package | Needed for | Phase |
|---|---|---|
| `react-native-reanimated` | sheet detents, ring animations | 1 |
| `react-native-gesture-handler` | sheet drag | 1 |
| `@gorhom/bottom-sheet` | 3-detent sheet — **chosen over hand-rolling** | 1 |
| `expo-blur` | glass material | 1 |
| `expo-haptics` | hold/arrival haptics (spec §8) | 4 |
| `lottie-react-native` *or* `rive-react-native` | sign-in background | 7 |
| `libphonenumber-js` | number validation (spec §4) | 7 |

`libphonenumber-js` is JS-only; the rest are native. `@gorhom/bottom-sheet` gives
us detents, snapping and keyboard handling — the last of which is the fiddly part
given search lives inside the sheet.

Install all of Phase 1's native deps in **one** batch so there is a single
rebuild, and pin versions through `expo install` so they match the Expo SDK.

### G3 · External accounts block Phase 6 entirely

Network location cannot start without commercial agreements. These have long lead
times and should be opened **now**, in parallel with Phases 1–5:

- A CAMARA / GSMA Open Gateway aggregator (Vonage, Nokia Network as Code, or an
  operator direct) for **Device Location Retrieval**, per market.
- SMS: UK provider and India provider, with **two-way** (inbound webhook) numbers.
- India: **TRAI DLT** registration for sender IDs and templates — weeks, not days.
- Legal review: UK GDPR + ICO Children's Code, India DPDP Act 2023 verifiable
  parental consent.

Phase 6 can be built and fully tested against mock adapters without any of these.
It cannot ship without all of them.

### G4 · Scope note

Option 15 is a re-shell, not a repaint. The journey flow built from
`journey-flow-spec.md` keeps its services, models, ports and Cloud Functions
unchanged — Phases 2–4 replace the **presentation** of that flow. No journey
service, provider or Firestore shape is rewritten to match Option 15's wording.

---

## 1. Engineering rules (apply to every phase)

Non-negotiable, and checked at each phase's exit.

**Layering**
- New external dependency → a port in `src/providers/` plus a `Mock*` adapter.
  Never call an SDK from a service, context or screen.
- Thresholds and rules live in services (pure, testable), not in contexts or JSX.
- Screens consume hooks only.

**No hard-coded values**
- Colours, spacing, radii, type → `src/config/theme.ts`.
- Timings, distances, limits, retention → `src/config/constants.ts` or the
  owning model file (the pattern `models/SafetyCheck.ts` already follows).
- Keys, URLs, provider endpoints → environment, surfaced through `app.config.ts`.
- Copy with a number in it derives the number from the constant, never repeats it.

**Memory and lifecycle**
- Every `setInterval` / `setTimeout` / `addEventListener` / `onSnapshot` /
  location watcher / notification subscription is cleared in the same effect's
  cleanup. Phase 0 adds `useInterval` / `useTimeout` so this stops being
  hand-rolled.
- Async work checks a `cancelled` flag or `AbortSignal` before calling `setState`.
- Context values are memoised; context functions are `useCallback`-stable.
- No unbounded in-memory arrays. `SafetyCheckContext`'s position buffer is already
  windowed — follow that pattern.

**Battery**
- Location frequency follows `TrackingConfig` tiers; never raise accuracy without
  a matching reason and an automatic restore. The "uneasy" boost (Phase 4) is
  15 minutes with a guaranteed revert, not a sticky mode.
- All location updates stop when a journey ends. Verify on device, not by reading
  code.
- No polling where a Firestore listener or a push will do.
- Cloud Functions on a schedule need a justification in their doc comment and a
  shutdown plan. `detectMissedCheckIns` is being deleted in Phase 0 for failing
  exactly this test.

**Errors, logging, security**
- User-facing errors say what happened and what to do next. Never a raw provider
  message.
- A failed convenience (saving a place, a route preview) never blocks a safety
  action.
- No PII in logs — no phone numbers, no coordinates.
- Secrets never reach the client bundle. Anything needing one goes in a Cloud
  Function and the app calls that.

**Reuse before adding**
- Search the codebase for the capability first. `PlacesService`, `RoutingService`,
  `LocationTrackingService`, `SOSService`, `NotificationService`,
  `OfflineSyncService` and the `Icon` / `Button` / `BottomSheet` primitives all
  exist. Extend them.

---

## Phase 0 · Stabilise — DONE

**Goal:** clear the debt in `ARCHITECTURE_DEBT.md` before building on top of it.
No new features. **Nothing in Phases 1–7 should start before this lands.**

| # | Work | Debt |
|---|---|---|
| 0.1 | **Re-wire** the interval check-in (see below) and move the actionable notification category onto safety checks | D1 |
| 0.2 | `useMemo`/`useCallback` all 21 context values; delete the `listHistoryRef` workaround in `journeys.tsx` | D2 |
| 0.3 | Close the three port breaches — expose position, route preview and journey history through their contexts | D3 |
| 0.4 | Single `haversineMeters` in `models/Place` | D4 |
| 0.5 | Add `useInterval` / `useTimeout` hooks; migrate the five contexts that hand-roll timers | D5 |
| 0.6 | Sweep remaining magic numbers into `constants.ts` / model files | rules |

### 0.1 in detail — RESOLVED: re-wire, do not delete

The interval check-in becomes Option 15's **"Check on me if late — 10 min"**
Settings control (`AI9`), so the subsystem stays. Phase 0 reconnects it rather
than removing it:

1. **Reconnect the interval.** Add a user preference (default 10 min, `null` =
   off) stored through the existing settings storage port, and pass it as
   `checkInIntervalMinutes` when a journey starts. This is the one change that
   turns ~6 unreachable files back into live code.
2. **Move the lock-screen actions.** Register the `I'm Safe` / `SOS` notification
   category on **safety checks** too, so the automatic check (the one that
   actually fires today) is answerable without unlocking. This closes the safety
   regression regardless of the interval decision.
3. **Keep `onMissedCheckIn`**; it becomes reachable again once step 1 lands.
4. **Re-justify `detectMissedCheckIns`.** The every-2-minutes schedule exists as a
   backstop for clients that die mid-journey. With the interval live it is
   defensible — but it must carry a doc comment saying what it catches that the
   client cannot, or be deleted. No scheduled function without a stated reason.
5. Settings UI itself lands in Phase 5; Phase 0 ships the preference, the default
   and the wiring.

**Exit:** `tsc` clean · suite green · emulator rules suite green · iOS bundle
builds · a journey started from the UI produces a non-null
`checkInIntervalMinutes` · the check-in notification carries action buttons · no
scheduled Cloud Function without a justification · grep audit in
`ARCHITECTURE.md §2` passes with zero violations.

---

## Phase 1 · Design system — DONE

**Goal:** Option 15's tokens and glass primitives, with no screen changes yet.

- Install Phase 1's native deps in one batch via `expo install`, then rebuild once.
- Replace `src/config/theme.ts`'s token **values** with the Option 15 set (G1).
  Keep the existing light/dark mechanism and the `ThemeColors` shape — this is a
  value change plus new tokens, not a rewrite of how theming works. Screens that
  already read tokens rather than hex literals pick the new palette up for free,
  which is the payoff for the Phase 0 hard-coded-value sweep.
- Glass material as **one component**, not a style copied around:
  `GlassSurface` handling iOS 26 `.glassEffect()` → `expo-blur` → Android
  `RenderEffect` → solid `#F9F9FB` @ 92% fallback (spec §2). Platform branching
  lives here and nowhere else.
- Primitives, all reusable: `GlassSheet`, `GlassPill`, `SafetyDock`,
  `PlaceButton`, `MemberRow`, `TimelineStep`.
- Accessibility from the start: 44×44 minimum targets, labels on every icon
  button, Dynamic Type to 200%, `AccessibilityInfo.isReduceMotionEnabled`
  respected by anything animated.

**Exit:** primitives render in both themes and both platforms · no raw hex outside
`theme.ts` · reduce-motion honoured · bundle builds.

---

## Phase 2 · Home as map + sheet — DONE

**Goal:** Option 15 `AI1` and `AI2`. The largest navigation change.

- Replace the four-tab bar with the full-screen map + 3-detent sheet
  (small ~330pt / half / full, opens at half). Journeys, Family and Settings
  become sheet destinations rather than tabs.
- **Search moves into the sheet** — tapping "Where to?" expands the same sheet, it
  does not push a route. Reuse `usePlaceSearch` and `PlacesService` unchanged;
  only the presentation moves. Debounce becomes 250 ms per spec §B (currently 300).
- Sheet contents: search row + `D` avatar → Settings; safety dock; places row;
  "Your circle".
- Search and dock never scroll away; the map stays interactive at small/half.
- Collapsing keeps the typed text for 5 minutes — a constant, not a literal.

**Reuse, do not rebuild:** `PlacesService`, `usePlaceSearch`, `SavedPlaceService`,
`useRoutePreview` for the per-place ETA chips, `AppMapView`.

**Also delivers:** D7 — `home.tsx` is split as a by-product.

**Exit:** 3 taps cold-start to a journey (spec §10) · sheet detents smooth at
60 fps · back behaviour defined on Android · no regression in the existing flow's
services.

---

## Phase 3 · Journey — Route, On the way, Arrived — DONE (bar open-places)

**Goal:** `AI3`, `AI4`, `AI6`.

- **Route timeline** (`AI3`): 3–5 steps built from the route. Needs OSRM
  `steps=true` — extend `RoutingProvider.getRoute` with an options argument; do
  not add a second routing port.
- **Open places on the way**: a new `PlacesProvider.searchOpenNearby` method, with
  the mock adapter returning fixtures. Gated behind a feature flag — it is a
  billable Places call per journey.
- **On the way** (`AI4`): turn banner, ETA capsule with check-in countdown ring
  (reuse `CountdownRing`), End button, "Feeling uneasy?" pill, safety dock.
- Arrival: 100 m for **20 s** per Option 15 §D — note this differs from the
  journey-flow spec's 30 s. Option 15 wins; it is one constant
  (`ARRIVAL_DWELL_MS`) and the detection logic is unchanged.
- **Arrived** (`AI6`): walk feedback Fine / Uneasy / Unsafe — **private, never
  shared with guardians**. Stored per journey with the route polyline.
- Android back from On the way returns Home with the journey running and a
  "Journey running · N min" chip — `useAndroidBack` already does this.

**Exit:** timeline derives from real route data, never placeholder steps · walk
feedback unreadable by guardians (enforced in Firestore rules, with a rules test)
· location stops on journey end, verified on device.

---

## Phase 4 · Safety — uneasy, fake call, SOS tiers — STARTED

**Goal:** `AI5`, `AI7`, `AI8`.

- **Feeling uneasy** (`AI5`): Call / Fake call / Nearest open / Tell my circle.
  `UneasyEvent` logged with time, location and choice.
- "Tell my circle" is explicitly **non-emergency** — a distinct notification type
  from SOS, and must read as such to guardians.
- The 15-minute location-frequency boost gets a guaranteed restore: a single
  owning timer that reverts even if the screen unmounts or the app backgrounds.
- **SOS two-tier hold** (`AI8`): 3 s → guardians + live location; 6 s → also offer
  emergency services (999 UK / 112 India, from market config, never hard-coded).
  10 s cancel window after sending. Reuse `SOSService` — backend unchanged.
- Haptics: light on check-in, stepped during the hold, success on arrival.

**Exit:** uneasy boost provably reverts (test the timer, not the UI) · SOS tiers
distinct and both cancellable · emergency number from config · no new SOS backend.

---

## Phase 5 · Settings

**Goal:** `AI9`–`AI12`. Everything configurable moves here; journey screens
configure nothing (spec §10).

- Settings opens from the `D` avatar as a sheet.
- Groups: profile · Family & circle · Basic-phone finding · Journeys (check-on-me,
  who sees journeys, pocket mode) · Safety tools (fake call, SOS hold time,
  Medical ID) · Privacy & consent.
- "Check on me if late" is where the Phase 0 decision lands if the interval
  check-in is kept as a user setting.
- Existing `contacts`, `profile` and `privacy` screens are re-homed here, not
  rewritten.

**Exit:** no journey screen asks the user to configure anything · every setting
persists through the existing storage ports.

---

## Phase 6 · Network location for basic-phone members

**Goal:** `docs/features/network-location-spec.md`, adapted to our architecture.
The largest phase; blocked commercially by **G3** but fully buildable against
mocks.

### 6.0 Architecture adaptation — read before coding

The spec describes a Node/Postgres/BullMQ backend. **We do not adopt that.** The
functional requirements map onto what we already have:

| Spec says | We do | Why |
|---|---|---|
| `LocationProvider` interface | **`NetworkLocationProvider`** port | `src/providers/LocationProvider.ts` already exists and means *device GPS*. Reusing the name would be a serious ambiguity in a safety system. |
| Provider adapters call CAMARA | App adapter calls **our Cloud Function**; the function calls CAMARA | Operator credentials must never enter the client bundle. Matches how the app already treats guardian alerting. |
| Postgres tables | Firestore collections under `users/{uid}/` | Existing storage. Rules enforce the invariants. |
| BullMQ jobs | Cloud Functions (`onDocumentWritten`, `onSchedule`, `onRequest`) | Already in use; `onSafetyCheckEscalated` is the same shape. |
| `MessagingProvider` | Server-side module in `functions/`, adapter per market | SMS needs secrets; it never belongs client-side. |
| `ConsentStrategy` | Port + strategy adapters, **server-side** | Per-operator, credentialled. |
| `basic_phone_members` table | A new `BasicPhoneMember` model **plus** a `CircleMember` view-model unifying it with the existing `FamilyMember` | `FamilyMember` is a two-sided app-user connection; a basic-phone member has no account. Forcing one storage model to serve both would break both. The UI gets one list; storage stays honest. |

**Do not create:** a second location stack, a second messaging stack, a second
family model, or a parallel notification path. Everything routes through the
existing ports.

### 6.1 Domain and ports
`BasicPhoneMember`, `Consent`, `ConsentEvent`, `LocateAudit`, `SafeZone` models.
`NetworkLocationProvider` port (`retrieve`, `verify`, `createGeofence`,
`deleteGeofence`) with a mock adapter. Consent state machine as a **pure service** —
`PENDING_SMS → SMS_APPROVED → OPERATOR_PENDING → ACTIVE`, any state → `DECLINED` /
`EXPIRED` / `REVOKED`. Unit-tested without Firestore.

### 6.2 Consent storage and rules
`consents` + append-only `consentEvents`. **Security-critical:** the client can
never write `ACTIVE` — only a Cloud Function may, after the inbound SMS webhook
confirms. Same one-way-door shape as the existing `ESCALATED` safety-check rule,
with rules tests to match. `STOP` must revoke from any state, immediately, and
disable every lookup and geofence.

### 6.3 Cloud Functions
Outbound consent SMS · inbound SMS webhook (signature-verified, idempotent) ·
`locate` callable enforcing **guardian check → consent ACTIVE → rate limit →
provider call → audit write → transparency SMS** in that order · operator token
refresh. No lookup path may skip the consent check — manual, SOS and geofence all
go through one guarded function.

### 6.4 App screens
Add someone (`S4`) · Family & circle (`S2`) · Member detail with consent status
and last finds (`S3`) · Find result (`AI13`) drawing the API radius as a circle
labelled "approximate", never a dot. Waiting and failure states: waiting for YES,
asking the network, phone off, STOP received, operator not supported.

### 6.5 Safe zones
CAMARA geofence subscriptions where supported; otherwise scheduled verification
at a cost-aware interval, only while consent is ACTIVE. Dedupe with hysteresis so
zone edges do not spam.

### 6.6 SOS and check-in by missed call / SMS
Virtual numbers per market. `HELP` or a missed call → immediate lookup bypassing
the per-minute limit but still audited → high-priority push + SMS to guardians.
If the lookup fails, **still alert** with "location unavailable". Check-in
keywords configurable per market, English and Hindi.

**Exit:** no lookup possible without ACTIVE consent, proven by a rules test and a
service test · transparency SMS always sent, throttled but never disabled ·
feature flag off by default per market · every provider endpoint either verified
against official CAMARA docs or marked `TODO` with the doc to check — **no invented
endpoints** · retention job deletes raw location after the configured window.

---

## Phase 7 · Sign-in v6

**Goal:** `AH1`–`AH4`.

Animated background (Lottie or Rive, 14 s loop) with a still frame under
reduce-motion · country picker defaulting from SIM/locale · `libphonenumber-js`
validation · 6-box OTP with platform auto-fill, auto-submitting on the sixth digit
· 60 s resend and "call me instead" · lockout for 10 minutes after 5 failures ·
location rationale before the permission request, while-in-use first.

The `DEV · any code works` pill must be compiled out of release builds, not merely
hidden — assert this in the build config.

---

## Phase 8 · Hardening

Device battery profile across a real journey · memory/leak pass (navigate every
screen 20×, confirm flat retention) · offline queue for check-ins and location
points with SMS fallback for SOS · structured metrics: lookup success rate,
latency, cost per lookup, SOS delivery time, consent conversion · full
accessibility pass · runbooks for provider outage, SMS failure, operator
revocation.

---

## Sequencing

```
Phase 0 ──┬─> 1 ─> 2 ─> 3 ─> 4 ─> 5 ──┬─> 8
          │                           │
          └─> 6 (mocks) ──────────────┘
                 ▲
                 └── G3 commercial track, starts now, blocks only 6's release
          7 can run in parallel from Phase 1 (independent surface)
```

Phase 0 gates everything. Phase 6 builds against mocks in parallel with 1–5 and
needs only its credentials to ship. Phase 7 touches no shared surface and can run
whenever capacity allows.

---

## Decision log

| Date | Decision | Effect |
|---|---|---|
| 2 Oct 2026 | **G1** — Option 15 supersedes the design handoff | Phases 1–5 re-theme and re-shell; `design-handoff.md` becomes historical |
| 2 Oct 2026 | **G2** — use `@gorhom/bottom-sheet` | 3 native deps in Phase 1; keyboard-in-sheet handled by the library |
| 2 Oct 2026 | **Phase 0.1** — re-wire the interval check-in, don't delete it | Becomes Settings "Check on me if late"; lock-screen actions move to safety checks regardless |
| 2 Oct 2026 | **Phase 3** — open places behind a flag, off by default | Timeline ships without it; enable once per-journey Places cost is measured |

## Still open

**G3 — commercial agreements for Phase 6.** Which CAMARA aggregator, which SMS
providers per market, and the India TRAI DLT registration. Phase 6 builds and
tests fully against mocks without these; it cannot ship without them. Long lead
times — start now, in parallel with Phases 1–5.
