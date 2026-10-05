# wayLoc — Option 15 implementation spec (for Claude Code)

**Goal:** Implement the Option 15 design: the Option 14 Home screen plus the Option 8 "companion" journey, all in the light glass style, with setup screens moved to Settings and the new animated sign-in.

The main path is: **open app → Where to? → type place/postcode → Go → walk → arrived.**

Design reference: the wayLoc design canvas, page "Simple home (15 options)".
- Option 15, top row: `AI1`–`AI8`
- Option 15, Settings row: `AI9`–`AI13`
- Sign-in: "Sign in v6" (`AH1`–`AH4`)

Build this in the app's existing framework, and reuse existing services (auth, location, SMS, push) where they exist. Don't rewrite working backend code just to match names in this document.

---

## 1. Principles (keep these when making decisions)

1. **Map first.** Home is a full-screen map with a pull-up sheet. No tab bar.
2. **Journey screens show only what's needed right now.** Anything set up once lives in **Settings**, opened from the **D** avatar next to "Where to?".
3. **The safety dock is always in the same place.** `Check in / I'm OK · Fake call · SOS` sits at the same position on Home and On the way. SOS is always bottom-right, press-and-hold.
4. **Never claim something we can't know.** Say "Mum & Alex can see you", never "You're safe". Network location is shown as an *approximate* circle, never as a precise dot.
5. **Light, calm and positive.** Everything is light mode first. Red is used only for SOS and destructive actions.

---

## 2. Design tokens

### Colour

| Token | Value | Use |
|---|---|---|
| `bg.map` | `#F2EFE9` | map land / screen fallback |
| `ink` | `#111214` | primary text |
| `ink.secondary` | `#5F6368` | secondary text |
| `tint` | `#0A84FF` | primary actions, route, your dot |
| `tint.soft` | `rgba(10,132,255,0.12)` | secondary buttons (Directions, Find) |
| `success` | `#34C759` | Check in / I'm OK, arrived, guardians "on call" |
| `success.text` | `#136B2E` | text on success-soft |
| `sos` | `#FF3B30` | SOS only |
| `sos.text` | `#D70015` | End, destructive text |
| `fakecall` | `#5856D6` | Fake call icon |
| `amber` | `#FF9F0A` | safe spots / open places, late check |
| `uneasy` | `#7B61FF` | "Feeling uneasy?" sparkle icon |
| `guardian.mum` | `#34C759` | avatar colour (generated per person in real app) |
| `guardian.alex` | `#FF9500` | avatar colour |
| `basicphone` | `#30B0C7` | basic-phone member (Sam), network-location circle |
| `brand.teal` | `#0B8A74` | sign-in screens, logo |

### Glass material (floating controls and sheets)

- Fill: white at 42–56% (top lighter), with backdrop blur 22 and saturation 190%.
- 1px white rim at 75% opacity, inner top highlight, and soft shadow `0 8 24 rgba(17,18,20,0.14)`.
- **iOS 26+:** use `.glassEffect()`. **Older iOS:** use `.ultraThinMaterial`. **Android:** use a translucent white surface with `RenderEffect` blur on API 31+; below that, use a solid `#F9F9FB` at 92% opacity.
- Sheets use a stronger glass (white at 80–86%) so text stays readable over the map.

### Shape and type

- Corner radii:
  - sheet: 40
  - cards and groups: 24
  - pills and buttons: half the height (fully rounded)
  - tiles: 22–24
- Font: system (SF Pro on iOS, Roboto/Google Sans on Android). Sizes:
  - large title 26–28 / 800
  - section 20 / 800
  - body 15–17 / 600
  - caption 12–13
- Minimum touch target: 44×44. Primary buttons are 54–58 high.

---

## 3. Screens and behaviour

### A · Home (`AI1`) — map and sheet

- **Map:** full screen and centred on the user. Floating at the top:
  - left: a glass pill showing guardian avatars + "Mum & Alex · on call"
  - right: a glass map-controls pill (layers, recentre)
- **Bottom sheet** with 3 heights: *small* (~330pt), *half*, and *full*. Opens at half.
  1. **Search row:** the "Where to?" field (mic icon), plus a **D** avatar button that opens Settings (`AI9`).
  2. **Safety dock:** a glass capsule [**Check in** | **Fake call**] and a separate round red **SOS** button.
  3. **Places:** Home, Work, Alex's, School (+ Add). Tapping a place opens Route (`AI3`). "+ Add" opens Add address.
  4. **Your circle:** one row per member.
     - App users: name, status ("At home", "1.1 mi away") and a **call** button.
     - Basic-phone members: "Basic phone" and a **Find** button, which opens the find result (`AI13`).
- Rules:
  - Search and the dock never scroll away.
  - The map stays interactive while the sheet is at the small or half height.

### B · Search inside the sheet (`AI2`)

- Tapping "Where to?" **does not open a new screen**. The same sheet expands to full height and the keyboard opens.
- The search field accepts a place, address or **UK postcode** (e.g. `NN2 8ET`). Results update as you type, with a 250 ms debounce.
- **Top result card:**
  - title, distance and address
  - **Go · 5 min**: starts the journey immediately with the default settings, skipping Route and going straight to `AI4`
  - **Directions**: opens Route (`AI3`)
  - "Mum & Alex will see you · arrive 21:44"
- **Other results:** a compact row each, with a small "Go · N min" pill.
- **X** collapses back to Home at the half height and keeps the typed text for 5 minutes.
- Saved destinations store **lat/lng, the full address and the postcode**, not just the typed text.

### C · Route — journey timeline (`AI3`)

- Map with the blue route, the destination pin and a glass "5 min" bubble.
- **Sheet header:** "Walk to" + destination name on the left; "5 min" + "arrive 21:44" on the right.
- **Timeline card:** 3–5 steps built from the route:
  - start ("You, now")
  - main road segments
  - **open places on the way** (shops or pharmacies open now, from Places data)
  - arrival
- Guardian row: "Mum & Alex with you · Check-in if you stop or run late", with a toggle (default **on**, using the defaults from Settings).
- **Start walk** button opens `AI4`.
- Travel mode (Walk / Bus / Car) defaults to the last mode used; it can sit as a segmented control above the timeline if needed.

### D · On the way (`AI4`)

- **Top:** a glass turn banner (arrow, distance, street).
- **Bottom stack, top to bottom:**
  1. **ETA capsule:** "3 min" plus "21:44 · NN2 8ET · check-in 4 min", the first guardian's avatar inside a **check-in countdown ring**, and an **End** button.
     - End asks "End journey?" and then goes to `AI6` with an "ended early" state.
  2. **"Feeling uneasy?"** pill, which opens `AI5`.
  3. **Safety dock:** [**I'm OK** | **Fake call**] + **SOS**.
     - I'm OK sends a check-in, resets the timer and shows the toast "Mum & Alex saw your I'm OK · 21:41".
- **Automatic events:**
  - **Arrival:** within 100 m of the destination (configurable) for 20 s, or the user taps End, opens `AI6`.
  - **Missed check-in:** if the timer expires, run the safety check from the existing app logic (popup → no reply in 60 s → alert guardians).
  - **Stopped:** no movement for 3 minutes off a known place triggers the same safety check.
- Pressing Back on Android or swiping back returns to Home while **the journey keeps running**. Home then shows a "Journey running · 3 min" chip at the top of the sheet; tapping it returns to `AI4`.

### D2 · Feeling uneasy? (`AI5`)

- A sheet over the dimmed map. Title "We're right here." and subtitle "Your walk keeps going."
- **Tiles:**
  - **Call Mum:** calls the first guardian.
  - **Fake call:** opens `AI7` after 5 s.
  - **Nearest open:** the nearest open place with walking time; tapping reroutes the journey to it.
  - **Tell my circle:** sends a *non-emergency* alert "Dev feels uneasy · live location", raises location update frequency for 15 minutes, and shows a confirmation toast.
- Bottom buttons: **I'm fine now** (back to `AI4`) and **Hold for SOS** (`AI8`).
- Log every uneasy event, with time, location and what was chosen, for the future AI route-safety work.

### E · Arrived (`AI6`)

- The map zooms to the destination, which shows a green check.
- Title "You made it, Dev." and subtitle "NN2 8ET · 21:44 · 5 min walk".
- Card: "Mum & Alex know you're safe · Sharing stopped", showing the latest guardian reply or reaction if there is one.
- **"How did the walk feel?" Fine / Uneasy / Unsafe** (single choice, optional). The caption must say "Private. Helps wayLoc suggest better routes later."
  - Store it per journey together with the route polyline. **Do not share it with guardians.**
- **Done** returns to Home at the small height. If the destination isn't saved yet, offer "Add to places".

### Fake call (`AI7`) and SOS (`AI8`)

- **Fake call:** an incoming-call screen from the configured caller (default the first guardian) over a blurred map, with Decline and Answer.
  - Answer plays a recorded or TTS voice.
  - A small note says "your journey keeps running".
- **SOS (press and hold):**
  - A ring fills and the screen shows "Keep holding · 2".
  - **After 3 s:** alert guardians with live location + call.
  - **Holding 3 s more (6 s total):** also offer or dial emergency services (999 UK / 112 India).
  - **Let go to cancel** before it fires. After sending, keep a 10 s cancel window.
  - Use the existing SOS backend.

### Settings (`AI9`–`AI13`, opened from the D avatar)

- **Settings home:** profile, Family & circle (count), Basic-phone finding, plus:
  - **Journeys:** Check on me if late (10 min), Who sees journeys, Pocket mode
  - **Safety tools:** Fake call caller & delay, SOS hold time, Medical ID
  - **Privacy & consent**
- **Family & circle:** members with a badge (`App` / `Consent ✓` / `Pending`), and **Add someone**.
- **Member detail (basic phone):** number and operator, consent status, last finds (each marked "Sam texted ✓"), limit (6 finds/hour), Resend consent text, **Stop finding** (red).
- **Add someone:**
  - name and number (operator lookup → "EE · supported")
  - phone type: Smartphone (app) or Basic phone
  - a 3-step explainer
  - a **parent/guardian tick**, required for under-18s
  - **Send request** sends the consent SMS
- **Find result:** a circle drawn from the API radius, "Last seen 08:42", "From network, not GPS", Call / Text / Go there, "Find again in N min" (rate limit), History.
- Waiting and failure states come from the Option 13 boards (`AA3`, `AA5`, `AA7`):
  - waiting for YES
  - asking the network
  - phone off / no signal, with last known location
  - STOP received
  - operator not supported

---

## 4. Sign-in (Sign in v6, `AH1`–`AH4`)

- **Background:** the light, animated "walk home" scene (SVG reference in the canvas). Rebuild it as a **Lottie or Rive** file (14 s loop).
  - Respect **Reduce Motion / Remove animations**: show a still frame instead.
  - Don't block input while it plays.
- **Phone screen:**
  - headline "Get home. Let them know."
  - country picker defaulting from the SIM/locale (🇮🇳 +91 / 🇬🇧 +44)
  - number auto-spaced
  - **Send code** enabled only when the number is valid (use libphonenumber)
  - Terms / Privacy line
- **Code screen:**
  - "Sent to +91 98765 43210 · Edit"
  - 6 boxes split 3–3, with OTP auto-fill (iOS `textContentType = .oneTimeCode`; Android SMS Retriever or SMS User Consent API)
  - **auto-submits on the 6th digit**
  - resend countdown (60 s) and "Call me instead"
- **Wrong code:** red boxes and "That code didn't match. N tries left." Lock for 10 minutes after 5 tries.
- **You're in:** explains why location permission comes next, then requests it (while-in-use first; ask for "always" only when the first journey starts).
- **Dev mode:** a small "DEV · any code works" pill, only in debug builds. Never ship it in release builds.

---

## 5. Data model (minimum)

```text
User        { id, name, phone, avatarColor, settings }
Place       { id, userId, label, kind(home|work|school|custom), lat, lng, address, postcode }
Member      { id, ownerId, name, phone, type(app|basic), role(guardian|child|friend),
              consentStatus(none|pending|active|revoked|unsupported), operator, createdAt }
Journey     { id, userId, destPlaceId|destLatLng, mode, startedAt, endedAt, etaAt,
              status(active|arrived|ended|alerted), lateCheckMins, watcherIds[], routePolyline }
CheckIn     { id, journeyId, at, kind(manual_ok|auto_prompt|missed), lat, lng }
UneasyEvent { id, journeyId, at, lat, lng, action(call|fake_call|nearest_open|tell_circle|sos|fine) }
WalkFeedback{ journeyId, rating(fine|uneasy|unsafe), at }           // private, for future AI
LocateAudit { id, memberId, requestedBy, at, lat, lng, radius, smsSentAt }
```

## 6. API (suggested — adapt to the existing backend)

```http
POST /api/journeys                     {dest, mode, watcherIds, lateCheckMins} -> {journeyId, etaAt}
POST /api/journeys/{id}/location       {lat, lng, speed, ts}                    (every 15–30 s; 5 s when uneasy)
POST /api/journeys/{id}/checkin        {kind}
POST /api/journeys/{id}/uneasy         {action}                                 -> notifies circle if tell_circle
POST /api/journeys/{id}/end            {reason: arrived|manual}
POST /api/journeys/{id}/feedback       {rating}
POST /api/sos                          {journeyId?, lat, lng, level: guardians|emergency}
GET  /api/places/search?q=&near=lat,lng                                         (postcode-aware)
GET  /api/places/open-nearby?lat=&lng=                                          (for timeline + Nearest open)
POST /api/family/members               {name, phone, type, parentConsent}
POST /api/family/members/{id}/locate   -> {lastLocationTime, center, radius} | {error}
```

- **`/locate`:**
  - checks guardian, consent and rate limit
  - calls the operator (CAMARA Device Location Retrieval) **from the server only**
  - writes `LocateAudit`
  - sends the transparency SMS "Dad viewed your approximate location at 08:42."
- **Consent SMS:**
  - inbound replies arrive by webhook
  - YES → `active`; STOP → `revoked`
  - store the message ID and the terms version

## 7. Notifications to guardians

| Event | Message | Channel |
|---|---|---|
| Journey start | "Dev started walking to NN2 8ET · ETA 21:44 · View" | push |
| I'm OK | silent update; shown in their live view | in-app |
| Tell my circle | "Dev feels uneasy · live location" | push, high priority |
| Missed check-in | "Dev hasn't checked in · last seen Glebe Road 21:41" | push + SMS fallback |
| SOS | "SOS from Dev · live location · Call" | push critical + SMS + call |
| Arrived | "Dev arrived safely at NN2 8ET at 21:44. Sharing stopped." | push |

## 8. Accessibility and quality checklist

- Every icon button has a label, e.g. "Press and hold for SOS" or "Settings and profile".
- Colour is never the only signal: status chips always include text.
- Supports Dynamic Type / font scale up to 200%: sheets scroll, and the dock stays pinned.
- Haptics:
  - light tap on I'm OK
  - stepped haptics while holding SOS
  - success haptic on arrival
- Battery: lower GPS frequency when stationary, and stop all location updates when a journey ends.
- Offline: queue check-ins and location points; SOS falls back to SMS.

## 9. Build order (suggested)

1. Design tokens + glass components:
   - `GlassSheet`, `GlassPill`, `SafetyDock`, `PlaceButton`, `MemberRow`, `TimelineStep`
2. Home + search inside the sheet (with postcode results).
3. Journey start → On the way → Arrived, plus check-in timer and arrival detection.
4. Feeling uneasy? + Fake call + SOS hold.
5. Settings (Journeys, Safety tools, Family & circle).
6. Basic-phone finding (consent SMS webhooks + `/locate`).
7. Sign-in v6 with the Lottie/Rive background.
8. Walk feedback storage (for the future AI route-safety model).

## 10. Acceptance criteria

- [ ] From a cold start, a user can start a journey to a typed postcode in **3 taps**: Where to? → result → Go.
- [ ] The safety dock is in the same position on Home and On the way, and SOS only fires after a hold.
- [ ] Guardians receive start, uneasy, missed check-in, SOS and arrival messages exactly as in section 7.
- [ ] "How did the walk feel?" is saved privately and never shown to guardians.
- [ ] Basic-phone find works only with `consentStatus = active`, respects the hourly limit, always sends the transparency SMS, and is audited.
- [ ] All setup lives in Settings; nothing on the journey screens asks the user to configure anything.
