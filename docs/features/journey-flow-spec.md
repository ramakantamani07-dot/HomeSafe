# wayLoc – Journey flow spec

Implement the journey flow below. Screen designs are on the "Final flow" page of the wayLoc design canvas (screens 01–10). Visual style (colours, fonts, soft header) follows `HANDOFF.md`.

## 1. Flow map

```
                     ┌──────────────── Done ─────────────────┐
                     ▼                                        │
 01 Home ──tap Home/Work──────────────► 04 Review ──Start──► [05 Allow location]* ──► 06 On the way ──arrive──► 10 Arrived
    │                                    ▲    │                                         │   ▲
    └─search box─► 02 Where to ──result──┘    └─Back─► (screen you came from)           │   │ View journey
                     │   ▲                                                              ▼   │
                     │   └──Save── 03 Add address                              07 Home (journey running)
                     └──"+ Add address"──┘

 * 05 shown only if location permission is not yet "Allow all the time".
 08 Safety check: shown automatically over 06/07 (late, stopped, off route).
 09 SOS: press-and-hold bar on 01, 06, 07. Cancel returns to the previous screen.
```

## 2. Screens

| # | Screen | Purpose | Main actions → goes to |
|---|---|---|---|
| 01 | Home | Start point. Greeting, sharing status pill, "Going somewhere?" card, Check in, Fake call, SOS bar, Family list | Search box → 02 · Home/Work chip → 04 (destination pre-filled) · SOS hold → 09 |
| 02 | Where to? | Pick any destination | Saved place with address → 04 · Saved place with no address → 03 · Search result → 04 · "Choose on map instead" → map picker → 04 · Back → 01 |
| 03 | Add address | Set up a saved place (first time only) | Save place → 02 (place now has address) · Back → 02 |
| 04 | Review & start | Confirm before sharing starts | Start journey → 05 or 06 · Change → 02 · Back → previous screen · "Save as a place" switch (only for unsaved places) |
| 05 | Allow location | Explain why, before the system prompt | Continue → system permission dialog → 06 · Not now → 04 |
| 06 | On the way | Traveller's live journey | I've arrived → 10 · Add time · Message · SOS hold → 09 · Back → 07 |
| 07 | Home (journey running) | Home with the "Going somewhere?" card replaced by a live journey card | Journey card / View journey → 06 |
| 08 | Safety check | Automatic check when something looks wrong | I'm OK → 06 · Add 15 min → 06 · I need help → 09 · No reply in 2 min → alert guardians |
| 09 | SOS | Emergency | Hold to send · Cancel → previous screen |
| 10 | Arrived | Confirms arrival, guardians told, sharing stopped | Save this place? (unsaved only) · Done → 01 |

## 3. Rules

**Destination input (02)**
- One search field: place name, street address, or UK postcode. Postcode → list of addresses at that postcode.
- Show "Your places" first, then results with name, address + postcode, distance.
- Debounce search (~300 ms), show results after 3 characters.
- Every destination is stored as: `name`, `formattedAddress`, `postcode`, `lat`, `lng`, `placeId` (from the provider). Never store only the typed text.
- Address provider: Google Places / Mapbox (worldwide) or getAddress.io / Ideal Postcodes / OS Places (UK postcode lookup). Choose one; wrap it in a `PlacesService` so it can be swapped.

**Back navigation**
- 04 Back returns to whichever screen opened it (01 or 02). 02 keeps the typed query and results.
- 03 Save returns to 02 and highlights the updated place.
- 06 Back does NOT end the journey. It goes to 07. Ending a journey only happens by arriving, "I've arrived", or "End journey" (with confirm).
- Android system back follows the same rules.

**Journey start (04 → 06)**
- Destination selected + location permission granted → start.
- Default alert rules: ask if OK when 10 min late or stopped 10 min; alert guardians if no reply in 2 min; send last location when battery < 10%. Editable via "Edit".
- Start sharing with the guardians shown ("Sharing with …").

**While running (06/07)**
- Home shows the live journey card (07) and the pill reads "Sharing with Mum & Alex".
- Keep a foreground service/notification on Android while sharing.
- Show freshness honestly: if last location update is older than 2 min, show "Last updated X min ago" in amber — never "Live".

**Arrival (10)**
- Auto-detect when within the place's arrival radius (default 100 m) for 30 s, or when the user taps "I've arrived".
- Notify guardians, stop sharing, show summary. Offer "Save this place?" only if the destination isn't saved.

**SOS**
- Press-and-hold (3 s with visible progress), never a single tap. 5 s cancel window after sending.

**Location permission (05)**
- Show 05 before the system dialog, first journey only (or whenever permission is missing).
- Android: request foreground location first, then background ("Allow all the time").

## 4. Copy to keep consistent
- Guardian names come from the user's contacts (e.g. "Mum & Alex"). Don't hard-code.
- Use "Press and hold for SOS" (not "Tap for SOS").
- Use "Start journey", "I've arrived", "View journey", "Done".
