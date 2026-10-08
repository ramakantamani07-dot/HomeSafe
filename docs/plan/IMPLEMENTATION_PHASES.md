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

## Status at 8 Oct 2026

| Phase | State | What is left |
|---|---|---|
| 0 · Stabilise | **Done** | D6/D7 were folded into Phases 2–3, which rewrote those screens |
| 1 · Design system | **Done** | — |
| 2 · Home as map + sheet | **Done** | — |
| 3 · Journey | **Done bar one item** | "Open places on the way" — see D4 below |
| 4 · Safety | **Done** | — |
| 5 · Settings | **Done bar one item** | "Pocket mode" — named in the spec, never defined; see D14 |
| 5b · Family redesign | **All steps done, against mocks** | Device check of the invite push and Ask "OK?" needs two real accounts |
| 6 · Network location | **6.1–6.4 done, against mocks** (incl. resend consent, D26) | CIBA operator callback (G3) · 6.5 safe zones · 6.6 SOS by SMS / missed call · device verification |
| 7 · Sign-in v6 | Not started | `AH1`–`AH4` boards never shared |
| 8 · Hardening | Not started | |

`AI5` was started early and deliberately: `AI4`'s "Feeling uneasy?" pill needs a
destination, and a button that goes nowhere is worse than no button. It ships
the two tiles the app can already do honestly — **Call guardian** and **Fake
call** — and simply omits the other two rather than rendering them inert.

### Fixed from on-device testing (8 Oct 2026)

First runs on an iPhone 15 turned up layout and navigation faults the test
suite cannot see. Each was fixed at its cause, not at the screen:

| Seen on the phone | Cause | Fix |
|---|---|---|
| Search sheet under the clock and battery; ✕ hard to tap | `MapSheet` full detent reached y = 0 | Full stops below the status bar; sheet sized to match |
| Appearance picker off-centre | No top margin against `SPACING.md` elsewhere | Even margin on all sides |
| Family's "Add someone" hidden until dragged up | Second sheet stacked at half height; OS clips the rest | `STACKED_SHEET_OPTIONS` — sheets opened from a sheet open full |
| "Location" squeezed to a letter per line | `ListRow` value could take the whole row | Value capped at 60% and wraps — fixes every row |
| "GO_BACK was not handled" — Back did nothing | `router.back()` with no screen behind | `useGoBack` goes Home when there is no history |
| iOS "Ask a parent to approve" on Call | Demo placeholder number handed to the dialler under Screen Time limits | `isUnreachableNumber` explains instead; emergency numbers never affected |
| "1 others" | Plural | Fixed |

### What is left

**Not yet proven against a real backend.** Everything below works against
mocks and the Firestore emulator, and has never run on Firebase or between two
real phones: consent SMS / STOP / locate (6.3), resend consent, revocation
layer 3, retention clean-up, live family status, watch presence, Ask "OK?",
the invitation push, and the "On wayLoc" lookup. Getting there needs a
Firebase project, `.env`, `firebase deploy` of rules, indexes and functions
(`docs/reference/RUNNING.md`), and a Firestore TTL policy on `smsInbound`.
**This is the highest-value next step.**

**Buildable now**

| Work | Phase |
|---|---|
| Safe zones for basic-phone members — CAMARA geofence or scheduled verify, hysteresis | 6.5 |
| SOS and check-in by SMS / missed call for basic-phone members | 6.6 |
| Battery profile over a real journey, memory pass, offline queue, accessibility pass, runbooks | 8 |

**Waiting on a decision or an input**

| Item | Needs |
|---|---|
| Sign-in v6 (Phase 7) | `AH1`–`AH4` boards |
| Pocket mode (D14) | What it should do |
| Open places on the way (D4) | Per-journey Places cost measured before the flag is turned on |
| Real network location, SMS (G3) | Operator aggregator, SMS providers, TRAI DLT, legal review |
| Revocation offline window; short-lived operator grants on the Phase 8 list? | Two open checkboxes in the revocation design |
| Known gaps below | Artwork (Android notification icon, app icon symbol), a support-email domain, EAS project rename, branding on OTP / biometric screens |

### Known gaps, none of them blocking

| Gap | Where | Note |
|---|---|---|
| Notification icon is the full-colour logo | `app.config.ts` | Android needs a monochrome silhouette or it renders a white blob |
| `BiometricGate` still uses shield + wordmark | `src/components/security/` | Everything else now uses the real logo |
| `otp.tsx` has no brand lockup | `app/(auth)/` | Decide whether branding carries through the flow |
| Support email is `hello@homesafeapp.com` | Terms, Privacy | Survived the rename — the domain is a real-world decision, not ours to invent |
| EAS slug still registered as `homesafe` | expo.dev | Rename the project before the first EAS build or it rejects the slug |
| Wordmark unreadable at icon size | `assets/icon.png` | ~8 px on a home screen; the symbol alone would read better |

---

## Revocation design (6 Oct 2026) — ACCEPTED 8 Oct, all three layers built

> **Status: accepted and built.** Three layers, with layer 3 as a Firestore
> trigger rather than a callable — see **D23**. Two follow-up questions below
> are still open; neither blocks anything.

### The question

How should "stop sharing this person's location" work, given it must never fail
in a way that leaves sharing switched on?

### What is built today

The Firestore rules let a client write `REVOKED` directly (**D17**). That makes
revocation immediate and offline-capable: tapping "Stop finding" never waits on
a backend, and "I stopped sharing" is not a promise that depends on signal.

### The gap this does not close

If the guardian's phone is **offline**, the write is queued locally and the
server does not see it. Lookups are gated server-side on the consent document,
so until that write syncs, a lookup could still succeed. Client-side revocation
gives immediate *local* effect, not immediate *server* effect.

So the client write is necessary but not sufficient.

### Proposed: three layers, not one

**1 · The member's own STOP text — the layer that always works**

They text STOP to our number: carrier → our webhook → server. This path does not
touch the guardian's phone, app or connectivity at all. If the person being
located wants it stopped, nothing on the guardian's side can prevent it. This is
the strongest layer, and why STOP appears in every message we send.

**2 · Guardian taps "Stop finding" — the client write (built)**

Instant, offline-safe, never blocks.

**3 · A companion server call — not yet built**

```
tap "Stop finding"
  → write REVOKED locally        (instant, offline-safe, never blocks)
  → call revokeConsent function  (propagation + operator cleanup)
       └ fails? queue it          (reuse the existing offlineQueue adapter)
```

The function does what the client cannot: revoke the operator token, delete
operator-side geofences, cancel in-flight lookups, send the member a
confirmation SMS.

### The principle behind the split

The local write is the **permission change** and must never wait on anything.
The function call is the **side effects**, and side effects may retry — they are
not what decides whether a lookup is permitted.

Put another way: granting permission should fail closed, so `ACTIVE` is
unreachable from a client. Removing permission must never fail in a way that
leaves sharing on. The same asymmetry already governs the SMS keywords — a
missed YES costs a resend, a missed STOP means locating someone who asked us not
to.

### What this still would not fix

A guardian who goes offline *immediately* after revoking leaves a window where
the server still believes consent is active. Closing that entirely means
short-lived operator grants that must be continuously renewed — real, but a much
larger change, and it trades a rare window for constant renewal traffic.

Layer 1 is the practical mitigation: the member can always stop it themselves,
independent of the guardian.

### Layer 1 is now built (7 Oct)

`inboundConsentSms` revokes every consent for the number on STOP, server-side,
without touching the guardian's device — see **D18**. Only layer 3 remains open.

### Suggested refinement to layer 3 — a trigger, not a callable

The proposal above calls a `revokeConsent` function and queues the call when it
fails. A Firestore `onDocumentUpdated` trigger on `consents/{memberId}` reaching
`REVOKED` would do the same side effects with less machinery: Firestore's own
offline persistence already queues the write, and the trigger fires the moment
it syncs. It needs no second queue, cannot be skipped by a client that writes
REVOKED without calling the function, and follows ARCHITECTURE §6 — *"a
Firestore write is the interface."* It also fires for revocations the server
makes itself (STOP), so the cleanup lives in one place. It does not narrow the
offline window; nothing short of short-lived operator grants does.

### To decide

- [x] Accept the three-layer design — **accepted 8 Oct**
- [x] Layer 3 as a Firestore trigger — **accepted 8 Oct** (D23)
- [ ] Is the offline window acceptable, mitigated by layer 1?
- [ ] Should short-lived operator grants go on the Phase 8 hardening list rather than being dismissed?

---

## Decisions settled 8 Oct 2026 — revocation layer 3, retention, Phase 6.4

### D23 · Revocation layer 3 is `onConsentRevoked`, a Firestore trigger

Fires on any consent reaching `REVOKED`, whoever wrote it, and runs once
(claimed through `revocationHandledAt`). It writes the audit event and the
circle mirror when the guardian's own device revoked — the one path where the
server did not make the change — and texts the member "*X* can no longer see
your location" unless they stopped it themselves (STOP is already confirmed by
the webhook) or were never told about the request.

To tell those apart, every server revocation records `revokedBy`. A client
cannot forge it: the rules let a revoke change only `status` and `updatedAt`.

Operator-token revocation and geofence deletion have a marked place in it and
nothing to do yet (G3, 6.5). In-flight lookups need nothing — `locate`
re-checks consent after the operator answers (D21).

**Deleting a guardian's account now revokes their consents** (trigger
`guardian-removed`) and removes their basic-phone members. The consent and its
events are kept as evidence. Before this, a deleted guardian's consents stayed
`ACTIVE` indefinitely.

### D24 · Lookup locations are cleared after 30 days; the audit is kept

Added to the existing daily `enforceDataRetention`, not as another schedule.
Only `location` and `accuracyMeters` are removed: "who looked me up, and when"
has to outlive "where I was". Paged, since this collection grows with every
Find. Audits carry `hasLocation` so the job uses one equality filter.

Covered by seven Firestore-emulator tests in `functions/` (`npm run
test:emulator` there) — locate's audit, rate-limit reservation, refusals,
market flag, revocation, and this clean-up — alongside the pure tests.

### D25 · Phase 6.4 screens, and where they differ from the boards

Built: Add someone (`add-someone`, S4), member detail (`basic-member`, S3),
find result (`find-result`, AI13); basic-phone members in the Settings circle
(S2) and in Home's "Your circle" with **Find**. Behind
`EXPO_PUBLIC_BASIC_PHONE_FINDING` (always on with mock data).

Each divergence is principle 4 — say only what is true:

| Board | Built | Why |
|---|---|---|
| "EE · supported" | "UK mobile" / "Indian mobile" | No operator lookup exists until G3; "supported" would be unchecked |
| Sam is texted "every time you look" | "at most once an hour" | The transparency text is throttled (spec §5) |
| "Sam texted ✓" on each find | Stated once as a rule | The server does not record which find a text went with |
| Avatar pin at the circle's centre | Circle only | The centre is not where the person is; a pin reads as a position |
| Parent/guardian tick always shown | Shown, and required, when "under 18" is on | Spec: required for under-18s. An adult consents for themselves by text |
| "Around Banbury town centre" | Absent | Would need reverse geocoding of an 800 m circle — a place name implies precision the circle denies |

A failed Find shows the last known area **only** when the phone could not be
reached. After a STOP or before a YES, an old location is exactly what the
member refused.

"Find" never runs on opening the result screen — the button that opened it
already asked — so returning from History never spends one of the hour's
finds. "Find again in N min" is computed from the same rule as the server's
rate limit (`nextLookupAllowedAt`).

Member numbers are validated narrowly — UK and Indian **mobiles** only — until
Phase 7 brings `libphonenumber-js`. A landline would pass general validation
and fail at the first Find, after the member had already been texted.

### D26 · Resending the consent request is a server call, limited

`resendConsentRequest` (callable) texts the request again — only while it is
still `PENDING_SMS`, at most once an hour and three times per request (spec §4
step 5, "resend with rate limits"). The limit and the fresh 48-hour deadline
are set server-side in one transaction with the check; a client trusted with
either could reset its own limit, and the rules refuse `resendsAt` on create.

Three is a judgement, recorded so it can be argued with: enough for "they
didn't see it", few enough that resend cannot become a way to pester someone
choosing not to answer. After the third, the screen says so and suggests a
call. The limits live in both `config.ts` and `models/Consent.ts`, held equal
by the parity test. S3's "Resend consent text" row is now built, shown only
while a request is waiting.

---

## Decisions settled 7 Oct 2026 — Phase 6.3

Three functions, in `functions/src/networkLocation/`, all running against mock
adapters only (G3):

| Function | Trigger | Does |
|---|---|---|
| `requestConsentSms` | consent created in `PENDING_SMS` | Sends the layer-1 request text; records delivery on the consent |
| `inboundConsentSms` | HTTPS webhook | Signature check → YES / NO / STOP → state transitions → reply text |
| `locateMember` | callable | guardian → ACTIVE → rate limit → operator → audit → transparency SMS |

The feature is off unless `NETWORK_LOCATION_MARKETS` names a market **and**
`NETWORK_LOCATION_ADAPTER` names an adapter; see `functions/.env.example`. No
real operator or SMS adapter exists — `ports.ts` lists the docs each must be
built against, per the spec's "no invented endpoints".

### D18 · What a reply means, server side

- **STOP revokes every consent for the number**, for every guardian who asked,
  in any non-terminal state. It is confirmed by text even when nothing was live.
- **YES approves only when exactly one delivered request is waiting.** Two
  guardians waiting on one number cannot be told apart by a bare YES, so neither
  is approved and the member is told nothing was shared. A request whose text
  never left us (market off, send failed) cannot be approved at all — the member
  would be agreeing to someone they were never told about.
- **NO declines every waiting request, and revokes any already answered.** A NO
  after approval is someone who no longer wants to be found; reading it as less
  than STOP would put the keyword list ahead of the person.
- **Unknown numbers get no reply**, per spec §7.

The webhook runs its transitions *before* recording the message as seen. They
are safe to repeat — the state machine refuses one that already happened — so a
failure midway lets the provider's retry finish the job. A STOP is never lost
to a de-duplication record written ahead of the work it stood for. The mark
guards only the reply text.

### D19 · No scheduled functions for expiry or token refresh

The 48-hour request deadline is applied **lazily**, when a reply arrives: an
expired request can only matter when someone answers it, which is exactly when
the webhook runs. A cron sweeping for them would spend invocations changing
nothing anyone can observe — the rule in §1 that a schedule needs a stated
reason. The guardian's screen can derive "they didn't reply" from `expiresAt`.

**Operator token refresh is not built**, because no operator tokens exist: the
mock strategy is `RECORDED_CONSENT`, which needs none. When a CIBA adapter
lands, refresh belongs inside it, on use, rather than on a schedule. CIBA's
`pending` outcome leaves the consent in `OPERATOR_PENDING` — not locatable, and
truthfully described as "setting up with their network" — until a callback or
`/token` poll exists for a real aggregator.

### D20 · The server's fields on the consent are locked twice

`locateMember` keeps the rate-limit window and the transparency throttle on the
consent document. A guardian who could create that document with `lastNoticeAt`
in 2099 would locate the member without their ever being told. So:

1. The rules now allow a client create with **only** the client model's keys
   (`hasOnly`), and a revoke that changes only `status` / `updatedAt`. Two rules
   tests, run against the emulator.
2. `requestConsentSms` resets `requestedAt`, `expiresAt`, `recentLookupsAt` and
   `lastNoticeAt` from server values whatever was written.

### D21 · How `locateMember` keeps its order honest

- The gate and the rate-limit reservation are **one transaction**, so two racing
  taps of Find cannot both pass a limit only one should.
- Consent is **checked again after the operator answers**. A STOP landing in
  the seconds a lookup takes discards the fix, and it is audited as refused.
  Stopping means the guardian does not see where they are, not merely that the
  next lookup fails.
- The callable always records `reason: 'manual'`. A client cannot claim `sos` to
  get past the rate limit; SOS lookups start server-side from the member's own
  text or call (6.6) and call `locate()` directly.
- The transparency throttle is claimed before sending and **released if the send
  fails**, so a provider outage means the next lookup tells them — not an hour
  of being found without knowing.

### D22 · The consent rules exist twice, and a test holds them together

`functions/` shares no module graph with the app, so `consent.ts` mirrors the
client's state machine, keyword lists and rate limit. Drift there would be a
security defect, not an inconsistency, so `src/__tests__/consentParity.test.ts`
imports both copies and compares every state × event, every keyword, a corpus of
replies and the rate limit. Checked by mutation: making ACTIVE expirable on the
server alone fails it.

---

## Decisions settled 6 Oct 2026

### D7 · Emergency numbers come from market config — RESOLVED

`999` was hard-coded at **four** sites, not the three first counted — the fourth
told guardians they could "call 999 for you" from the safety-check overlay.
`src/config/markets.ts` now resolves it: configured market → device region (via
`Intl`, so no new native module) → fallback.

**112 is the fallback, deliberately.** It is the GSM standard: handsets route it
to local emergency services across the UK, the EU and India, usually even with
no SIM or credit. When we cannot establish where someone is, that is the number
most likely to reach help, and guessing a national one from weak evidence would
be worse. North America is listed explicitly because 112 is *not* reliably
routed there — the one place being wrong is least recoverable.

Known limitation, recorded rather than solved badly: this reads the device
*region*, not where the user physically is, so a traveller abroad is offered
their home number. Doing better means reverse-geocoding during an emergency,
needing network and a fix exactly when both are least reliable.

### D8 · The SOS tier is decided by the hold, not by a pre-selected mode

`AI8`'s two tiers ride on one continuous gesture — 3 s alerts guardians, 6 s
also offers emergency services — because an emergency is the worst moment to ask
someone to choose between buttons first. Tier 2 pre-selects the emergency mode
on the SOS screen: a person who held for six seconds has already said what they
want. The hold fill resets at the tier boundary, so reaching tier 1 reads as an
arrival rather than as the halfway point of something unfinished.

**One deliberate divergence.** The alert fires when the gesture *completes* — on
release, or at tier 2 — not the instant 3 s is crossed, so a six-second hold
alerts guardians up to ~3 s later than a literal reading. That is the price of
one gesture carrying two intents, and it buys the ability to escalate without
lifting and pressing again. Commented at the call site.

### D9 · The uneasy boost ends by arithmetic, not by a callback — RESOLVED

Phase 4's exit criterion is "test the timer, not the UI". A countdown is the
obvious implementation and the wrong one: it can be frozen by backgrounding,
killed with the screen that started it, or simply lost — and a location boost
that silently never ends is a battery drain the user cannot see.

`isUneasyBoostActive(startedAt, now)` is a timestamp comparison, re-evaluated on
every tracking-config resolution. Losing the timer degrades to "the next
resolution fixes it". The timer exists only to re-apply the sampling rate at
expiry, and is armed from the deadline on tracking start and released on stop,
so it survives restarts without outliving a tracking session.

`UNEASY` sits between `JOURNEY` and `SOS`, and outranks the low-battery
downgrade — the user knows their battery is low and asked anyway.

### D11 · Haptics are named by meaning, not by feel

`src/utils/haptics.ts` exposes `checkIn()`, `sosTierReached()`, `arrived()` and
`nonEmergencySent()` rather than letting screens call `impactAsync` directly, so
how something feels is one edit instead of a search. Every call is
fire-and-forget and swallows errors: haptics are absent on the simulator, on
many Android devices, and whenever the user has turned them off, and an SOS that
threw because the phone could not buzz would be an absurd way to fail.

The SOS step is the one that matters. The hold has two thresholds and the user's
eyes may be anywhere, so the pulse at 3 s is how they learn their guardians have
been told without looking — Medium at tier 1, Heavy at tier 2, so the two are
distinguishable through a pocket. It fires once per crossing, guarded by a ref,
because the progress tick runs every 50 ms.

Arrival's success pulse is suppressed when the journey was ended early: nothing
was achieved, and congratulating someone for stopping would read as mockery.

### D10 · "Nearest open" is a separate port, and never says "open"

The phase plan called for `PlacesProvider.searchOpenNearby`. That was written
before we established that CLGeocoder — the free tier backing address search —
cannot do point-of-interest lookup at all. Adding the method there would force
`PlatformGeocoderPlacesProvider` to implement something it has no way to answer,
and returning `[]` from it would leave the feature silently dead on the default
configuration. It is `SafePlaceProvider` instead.

The search is a local Swift module (`modules/nearby-places`) wrapping
`MKLocalSearch` — free, keyless, no account. Per **D4**, Apple publishes no
opening hours, so the categories are restricted to places staffed around the
clock (police, hospital, fire, pharmacy, fuel, hotel) and the heading reads
"Open around the clock", never "open now". Cafés and shops are absent by design:
a café at 2am is exactly the guess that sends someone to a locked door.

Results rank by **kind first, then distance** — a police station 600m away beats
a hotel 200m away, and distance alone would bury it. Tapping one opens
directions rather than rerouting the journey: changing the destination would
silently change where guardians believe this person is going, and they may want
the police station *and* still be expected home.

### D12 · Alert rules moved to Settings — RESOLVED

§10's acceptance criterion is *"All setup lives in Settings; nothing on the
journey screens asks the user to configure anything."* An audit of every journey
screen found exactly one violation: Review's "Edit" on the alert rules.

The rules now live in `JourneyPreferences` — which its own comment already
anticipated ("These are the defaults those rules are seeded from") — and Review
displays them read-only. The capability moved rather than vanishing: **If I'm
late by** and **If I stop for** are Settings rows.

`alertRules` was removed from `JourneyDraft` entirely rather than seeded into it,
so there is one source of truth instead of two that could drift. The three
journey-start sites read preferences directly. `AlertRulesSheet.tsx` (176 lines)
became orphaned and was deleted.

Two switches survived the audit and should: Review's "Save as a place" is an
action about that destination, and Route's guardian toggle is specified
explicitly ("with a toggle, default on, using the defaults from Settings").

### D13 · Two screens existed but were unreachable

`family.tsx` — 390 lines of working screen — lost its only entrance when Phase 2
removed the four-tab bar, and nothing replaced it. `JourneyPreferences` was fully
modelled, validated and persisted, but no control ever set it, so "Check on me"
silently used the 10-minute default forever.

Both are now connected from Settings. Worth recording because neither was
visible as a bug: the code was correct, tested and dead.

### D14 · Pocket mode — OPEN, deliberately not guessed

The spec names "Pocket mode" once, in the Settings list, and defines it nowhere.
Plausible readings differ enough to matter — suppress accidental touches, dim the
screen, keep tracking with the UI locked — and the most obvious one is already
handled: SOS is press-and-hold *precisely* so a pocket tap cannot raise an alarm.

Left unimplemented rather than invented. Needs a product decision about what it
should do.

### D15 · Consent is a pure state machine, and ACTIVE has one door

`src/services/ConsentStateMachine.ts` decides whether one person may see
another's location, so it is a pure module — no context, no Firestore, no
network. It has to be exhaustively testable, and it has to read identically on
the client and in Cloud Functions: the server enforces it, and the client must
predict the server's answer to show honest UI.

The transition table is narrow on purpose. A test enumerates **every** state
crossed with **every** event and asserts that exactly one route reaches `ACTIVE`
— `OPERATOR_PENDING` via `operator-approved`. A member who replied YES but whose
operator has not authorised is not locatable; if any other path existed, consent
would be a formality.

Two asymmetries, both deliberate:

- **`ACTIVE` cannot expire.** It ends because somebody ended it, never because a
  clock ran out while the member believed they were still sharing.
- **STOP is read far more loosely than YES.** It matches anywhere in the message
  and beats an approval in the same text, while approval must be the entire
  message. A missed YES costs a resend; a missed STOP means locating someone who
  asked us not to.

### D17 · A client may reach exactly two consent states

The Firestore rules are the enforcement boundary for network location, and they
allow a client to write only `PENDING_SMS` and `REVOKED`:

```
PENDING_SMS   asking is something a guardian may do
REVOKED       stopping must always work, immediately, from any state
```

`SMS_APPROVED`, `OPERATOR_PENDING`, `ACTIVE`, `DECLINED` and `EXPIRED` are
writable only through the Admin SDK, which bypasses rules. `ACTIVE` means "the
member texted YES *and* their operator authorised it" — neither fact the
requesting device is in any position to assert about somebody else.

Ten rules tests, all run against the emulator rather than skipped. They cover the
negative cases that matter: ACTIVE cannot be written by update *or* by creating
a document already in that state, no intermediate state is reachable, a consent
record can never be deleted, another user cannot read or create one, locate
audits refuse all client writes, consent events are append-only and cannot claim
ACTIVE, and a member's phone number is immutable — changing it would silently
transfer permission to whoever holds the new SIM.

**Revocation is deliberately client-side** rather than routed through a function.
The spec requires STOP to work "any time", and stopping must not depend on a
backend being reachable. Permission is the thing that should fail closed.

### D16 · Mock network location is deliberately imprecise

`MockNetworkLocationProvider` reports ~650m accuracy, because network location
genuinely is that coarse. A mock returning GPS-grade precision would let us
build screens that promise more than the real thing can deliver, and the gap
would only surface after the commercial agreements landed.

It also exposes `denyConsentFor()`, so refusal paths are exercisable — the
failure cases are the ones that matter in a consent system.

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

## Phase 4 · Safety — uneasy, fake call, SOS tiers — DONE

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

## Phase 5 · Settings — DONE (bar pocket mode)

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

## Phase 5b · Family redesign — PLANNED (8 Oct 2026)

**Goal:** replace the current Family page and Invite Family Member screen with
the Option 15 family flow. Design source: `assets/imgs/family/`.

| Board | File | Replaces |
|---|---|---|
| Flow notes | `flow.png` | — (the written brief for the boards below) |
| S2b · Family | `Family-invite-screen.png` | `app/(app)/family.tsx` |
| S2c · Watching Emma | `Family-member-watching.png` | new — "Watch live" |
| Invite someone | `invite-screen.png` | `app/(app)/family-invite.tsx` |
| Invite sent | `invite-status.png` | the `Alert` after sending |

### What the boards change

**S2b · Family**
- Same glass sheet over the map as Settings: back, title, round blue **+**.
- The illustrated hero goes. In its place, one slim summary line: avatars +
  "1 travelling · …" + "Updated just now". Useful, not decoration.
- **Travelling now** first. Emma's card: live progress bar to her destination,
  "19 min · to Home · arrives 21:58", a call button and **Watch live**.
- **Family** list in compact rows: Tom "At school · 2 min ago" + call; Sam
  "Basic phone · consent ✓" + **Find** (already built in 6.4).
- **Add someone** + a one-line basic-phone note.

**S2c · Watching Emma ("Watch live")**
- Map with Emma's route and position; "Live · updated 10 s ago" pill.
- Sheet: "Emma is walking home", road · battery; progress bar, "19 min ·
  arrives 21:58 · 0.9 mi left"; last "I'm OK" and next check-in.
- **Call · Message · Ask "OK?"**. Ask "OK?" sends her a check-in prompt.
- "Emma can see that you're watching."

**Invite someone**
- **Choose from contacts** first (fastest), or type the number: country
  picker, auto-spaced, focus ring.
- Recognises the person: "Priya Sharma · On wayLoc ✓", or "Not on wayLoc —
  we'll text a link", or a basic phone, which hands over to the SMS consent flow.
- **"Who is Priya to you?"** with eight chips: Daughter, Son, Parent, Partner,
  Sibling, Grandparent, Friend, Other. This replaces the confusing "your
  relationship to them".
- Shows what is shared **before** sending: she sees your journeys only while
  you share one; you see hers if she accepts.
- The button names the person, "Send invite to Priya", and stays disabled
  until the number is valid.

**Invite sent**
- Avatar + "Invite sent to Priya", a Pending card with its expiry (7 days —
  already `INVITATION_EXPIRY_DAYS`), **Done** / **Invite someone else**.

### What exists, and what each element needs

Checked against the code on 8 Oct. Most of the redesign is presentation over
data we already have. The rest is listed so nothing on a board is built as a
claim the app cannot back.

| Element | Status | Work |
|---|---|---|
| Sheet layout, rows, call buttons, Add someone | ✅ data exists | Presentation only |
| Sam's row with Find | ✅ built (6.4) | Reuse `MemberRow` kind `basic` |
| "arrives 21:58" | ✅ `activeJourneyEta` in shared status | — |
| "updated 10 s ago", battery | ✅ `updatedAt`, `batteryLevel` in shared status | — |
| 7-day pending expiry | ✅ `INVITATION_EXPIRY_DAYS = 7` | — |
| **Live** updates | ⚠️ `FamilyContext` loads once and on pull-to-refresh | Subscribe to `sharedStatus` (`onSnapshot`) while Family or Watch live is open, and only then — battery rule |
| Progress bar, "0.9 mi left", route on the map | ❌ not published | Publish `routeProgress` (fraction, metres left) and a simplified polyline in shared status, gated on `shareJourneyDetails` |
| Last "I'm OK" · next check-in | ❌ not published | Add `lastCheckInAt` / `nextCheckInAt` to shared status |
| "Emma can see that you're watching" | ❌ no presence | A watcher document under the connection, set while Watch live is open and expiring by timestamp, plus a rules entry; Emma's On the way screen shows it |
| Ask "OK?" | ❌ no such message | Callable → push to Emma with the existing I'm Safe action category; her answer updates `lastCheckInAt`. Rate-limited |
| Choose from contacts | ❌ `expo-contacts` not installed | Native dependency: must clear `DEPENDENCIES.md`; permission asked only on tap |
| "On wayLoc ✓" recognition | ❌ users are owner-readable only | A rate-limited callable answering "has an account" for one number. **Decision F1** |
| "Not on wayLoc — we'll text a link" | ❌ no SMS for invites | Server SMS, same providers as Phase 6 (G3). **Decision F2** |
| "She'll get a notification to accept" | ❌ no invitation push | `onFamilyInvitationCreated` function → FCM to the invitee, if they have the app |
| New relationship chips | ⚠️ list differs, meaning inverts | **Decision F3** |

### Copy that must change to stay true (principle 4)

| Board says | Build says | Why |
|---|---|---|
| "1 travelling · **2 safe**" | "1 travelling · 2 not travelling", or name the places ("Tom at school") | We know who is on a journey, not who is safe. "Safe" is the one word this app must never guess |
| Basic phones "texted **each time**" | "texted when you look, at most once an hour" | The transparency SMS is throttled (spec §5) |
| "She'll get a notification to accept" | Only once `onFamilyInvitationCreated` exists, and only for app users; otherwise "She'll see it when she opens wayLoc" | No invitation push exists today |
| "Sharing stops when she arrives" | Only when her mode is `SHARE_DURING_JOURNEY` | Members on "Share always" keep sharing |

### Decisions — settled 8 Oct 2026, all as recommended

- **F1 · Should Invite reveal whether a number is on wayLoc?** It is
  convenient, and it is also a lookup anyone can run against any number.
  Options: (a) reveal, rate-limited per user per day; (b) reveal only for
  numbers already in the inviter's contacts; (c) never reveal — always say
  "If they're on wayLoc they'll get it in the app; if not, we'll text them".
  **Decided: (b)** — reveal only for numbers in the inviter's contacts, which
  matches the board's "From your contacts" path.
- **F2 · Text a link to people not on wayLoc?** Needs an SMS provider per
  market (shared with G3) and India DLT templates. Until then the board's
  "we'll text a link" line is replaced by a share sheet: "Send them the link
  yourself". **Decided:** share sheet until an SMS provider exists.
- **F3 · Relationship wording.** The board asks "Who is Priya to you?"
  (Daughter, Son, Parent, Partner, Sibling, Grandparent, Friend, Other). The
  current list answers the opposite question ("your relationship to them":
  Parent, Child, Spouse, …). Stored invitations would read backwards after
  the change. **Decided:** store the new question in a new field
  (`theyAreMy`), and show old records with their existing label.
- **F4 · Watch-live presence.** Should the person being watched see *who* is
  watching, or only *that* someone is? The board says "Emma can see that
  you're watching". **Decided:** who, by name — it is her location.

### Progress — 8 Oct 2026

- **Step 1 done.** Shared status carries `journeyProgress`, a route simplified
  to 40 points, `lastCheckInAt` and `nextCheckInAt`, all behind
  `shareJourneyDetails`; route and progress also need `shareLocation`, because
  together they are a position. Progress is measured on the traveller's phone
  from their own route. Republished on a new route or a check-in answer, not on
  a timer.
- **Step 2 done.** `useLiveFamily` holds `sharedStatus` listeners open only
  while Family or Watch live is mounted, counted so two screens share one set.
- **Step 3 done.** `family.tsx` rebuilt on the S2b layout, with invitations
  received and sent kept as compact rows.
- **Step 4 done.** `watch-member.tsx` shows route, position, live freshness,
  progress, ETA, distance left, battery and check-in times. Opening it writes
  `familyConnections/{id}/watchers/{watcherId}` — refreshed every minute, gone
  on close, lapsing by itself after two minutes — and the traveller's On the
  way pill reads "Mum is watching" (F4: by name). Rules: only the watcher
  writes it, only about the other member, only members read; one emulator
  test. The traveller listens only during a journey, so Watch live says
  "can see that you're watching" only then.
  *Limitation, recorded:* presence is courtesy, not enforcement. Reading
  `sharedStatus` does not require announcing, so a modified client could watch
  silently. Enforcing it would mean gating `sharedStatus` reads on a presence
  document, which would also hide the Family list — not worth it for v1.
- **Step 5 done.** `askMemberOk` (callable): asker must be an active member,
  the member must be travelling *as shared with the asker*, once per five
  minutes per pair; push with I'm OK / SOS buttons. Only the I'm OK button
  answers — opening the push does not — and the answer is published as a fresh
  `lastCheckInAt`, so it reaches Watch live through shared status with no reply
  channel of its own. Watch live says "Asked at 21:45 — waiting" until then,
  and "Couldn't reach Emma" when the member has no device registered (always,
  for mock demo people).
- **Found and fixed on the way:** the publisher reported `HOME` for anyone not
  on a journey, and the badge drew it in green — "at home" and "fine", from
  nothing. New status `IDLE` ("Not on a journey") is the default; legacy `HOME`
  documents now read the same and are no longer green.

- **Step 6 done.** `family-invite.tsx` is Invite someone: Choose from contacts
  (`expo-contacts` picker — passed the dependency gate, see DEPENDENCIES.md;
  no contacts permission on iOS), or type the number; "On wayLoc ✓" only for a
  picked contact (F1), through `lookupInvitee`, limited to 20 numbers per
  account per day server-side — the server cannot prove a number came from
  contacts, so the limit is the real enumeration defence; "Who is Priya to
  you?" chips stored as `theyAreMy` (F3), with the person invited shown the
  inverse (Daughter → Parent) and nothing where no honest inverse exists;
  what is shared, read from the actual connection defaults; a button naming
  the person. `invite-sent.tsx` replaces the alert: pending card with real
  expiry, "Message them how to join" through the share sheet (F2), and a
  next-step line that depends on whether they have wayLoc.
  `onFamilyInvitationCreated` pushes the invitee when they have the app, so
  the screen's notification line is true when it is shown.
- **Step 7 done.** Add someone's smartphone path hands over to Invite someone.

### Work, in order

1. **Shared-status data.** `routeProgress`, simplified polyline, check-in
   times, published from `FamilyService.publishStatus` behind the existing
   permission flags, with rules tests that a non-member cannot read them.
2. **Live subscription.** `FamilyContext` subscribes to `sharedStatus` while a
   family screen is mounted, and unsubscribes on unmount.
3. **S2b Family.** Rewrite `family.tsx` on the glass sheet; split it into
   `TravellingCard`, `FamilySummary` and the existing `MemberRow`. Pending
   invitations and sent invitations keep a place, in compact rows.
4. **S2c Watch live.** A new screen, the watcher presence document, and the
   indicator on the watched person's On the way screen.
5. **Ask "OK?".** Callable + push + rate limit; the answer reuses check-ins.
6. **Invite someone + Invite sent.** Rewrite `family-invite.tsx`; contacts
   (after the dependency gate), recognition (per F1), relationship (per F3);
   `onFamilyInvitationCreated` push.
7. **Add someone (S4)** stays the basic-phone path. The smartphone path hands
   over to the new Invite someone.

**Exit:** every number on these screens comes from published data, never a
placeholder · no "safe" claim · live updates stop when the screen closes,
verified on device · rules tests for each new shared field and the watcher
document · the "On wayLoc" lookup cannot be used to enumerate numbers (per F1).

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
| 8 Oct 2026 | **Revocation** — three layers, layer 3 a Firestore trigger | D23 |
| 8 Oct 2026 | **F1–F4** — family redesign: contacts-only recognition, share sheet until SMS, new `theyAreMy` field, watchers shown by name | Phase 5b |

## Still open

**G3 — commercial agreements for Phase 6.** Which CAMARA aggregator, which SMS
providers per market, and the India TRAI DLT registration. Phase 6 builds and
tests fully against mocks without these; it cannot ship without them. Long lead
times — start now, in parallel with Phases 1–5.
