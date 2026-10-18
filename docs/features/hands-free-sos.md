# Hands-free SOS

**Status (18 Oct 2026):** Phase 0 and Phase 1 (iPhone) built. Server tested on
the emulator; the Siri path tested on a device only as far as a development
build allows — a real SOS needs the deployed backend.

Someone in danger says **"Siri, WayLoc help me"** — or presses the Action
Button, or taps the back of the phone — and the same SOS as the SOS button
goes out, **without unlocking the phone**.

## Why Siri, and not "Hey WayLoc"

iPhone lets only Siri listen all the time. An app keeping the microphone open
in the background to wait for its own phrase would show the orange dot
constantly and risk App Store rejection, and would still not work on a locked
phone in a pocket. So on iPhone the phrase names WayLoc *through* Siri. Apple
requires every Siri phrase for an app to contain the app's name.

Phrases (`SIRI_PHRASES`, and `WayLocShortcuts` in Swift — a test keeps them
equal): "WayLoc help me", "Help me with WayLoc", "WayLoc SOS", "Send WayLoc SOS".
The same action appears in Shortcuts, so it can be put on the Action Button or
Back Tap.

Android ("WayLoc, help me" with an on-device listener, during journeys) is
Phase 2.

## How it works

```
"Siri, WayLoc help me"
  → SendSOSIntent  (targets/sos-intent — an App Intents extension; the app does not open)
      reads the SOS key from the shared Keychain   (SosVault.swift)
      takes a quick location fix (≤4 s) or the last position the app saved
  → POST deviceSos  (functions/src/sos)
      checks the key, rate limit, duplicate
      writes users/{uid}/sosEvents/hf-{requestId}  — the record the app writes
  → onSOSTriggered  (unchanged) → push to contacts with WayLoc, text to the rest
```

**One emergency path.** `deviceSos` writes the same SOS record as the app, so
every alert, the live location and the emergency screens behave exactly as for
the SOS button.

**Why it sends the SOS itself.** Opening the app from a locked phone needs Face
ID, and an App Intents extension cannot hand over to the app on screen (the
SDK marks `ForegroundContinuableIntent` unavailable in extensions). So the
extension makes the request directly.

## The SOS key

The extension has neither the person's login nor the app's code. It holds an
**SOS key** instead:

- Issued by `registerSosKey` when the person turns hands-free SOS on; returned
  once. Only its SHA-256 is stored (`sosKeys/{keyId}`, server-only in the
  rules, tested).
- Can do one thing: start an SOS for its owner. It cannot read anything.
- Kept in a Keychain group shared by the app and the extension
  (`keychain-access-groups`, the same first group in both), readable after the
  first unlock since restart, **this device only** — a backup or a new phone
  does not inherit it.
- Revoked when the feature is turned off, before sign-out (profile screen), and
  deleted with the account (`onUserAccountDeleted`). The phone's copy is wiped
  on any sign-out (`HandsFreeSosStateProvider`).
- At most 5 live keys per person; 3 SOS per key per 10 minutes.
- Not behind App Check: the extension has no Firebase SDK to mint a token. The
  key is the credential.

## Honest behaviour

| Situation | What Siri says |
|---|---|
| Sent | "SOS sent. WayLoc is alerting your trusted contacts." (sent to the server; the alerts follow there) |
| Test mode (10 min, from Settings) | "Test only. Hands-free SOS works, and nobody was alerted." — or that no trusted contacts exist yet |
| Not set up on this phone | Where to turn it on, and to call 999 / 112 |
| Development build (no server) | That nothing was sent, and to call 999 / 112 |
| Just sent (rate limit) | That an SOS was just sent, and to call 999 / 112 |
| No connection | That WayLoc couldn't reach its server, and to call 999 / 112 |

Location: the phone's own fix when it gets one within 4 seconds; otherwise the
last position the app saved during a journey (at most once a minute); on the
server, the active journey's last position if newer. When the fix is more than
5 minutes older than the SOS, the alert says when it was taken — "Last known
location (21:42)".

**Languages.** Hindi and English (India) phrases are in
`targets/sos-intent/AppShortcuts.xcstrings` (Siri uses them when its language
is set to one of those): "WayLoc मदद करो", "WayLoc बचाओ", "WayLoc से मदद
चाहिए", "WayLoc एसओएस", "WayLoc एसओएस भेजो", and in Indian English "WayLoc
bachao", "WayLoc madad karo". Xcode validates the catalog at build time; a
test keeps it and Settings in step.

**Needs iOS 17.** App Intents extensions are ExtensionKit extensions, so the
Siri action exists from iOS 17; on older phones Settings says so instead of
offering a switch that does nothing.

**Not built:** sending a text by itself when offline (iPhone does not allow
it); an SOS queued on the phone for later (an extension cannot run again on
its own).

## Phase 0 — the app lock never holds an SOS back

Fixed alongside: an SOS from the widget or tile opened the app behind the Face
ID app lock and was not sent until the person unlocked it. See
`docs/reference/ACCOUNT_PROTECTION.md` and `lockPolicy.ts`.

## Tests

- `functions/src/__tests__/handsFreeSos.test.ts` — key matching, rate limit,
  request validation, which location is used, alert wording.
- `functions/src/__tests__/handsFreeSos.emulator.test.ts` — the whole server
  path: the same SOS record, one SOS per trigger however often retried, wrong
  / unknown / revoked keys, the rate limit, test runs alert nobody, the
  journey's position as fallback, the key limit.
- `src/__tests__/firestoreRules.test.ts` — no phone can touch `sosKeys`.
- `src/__tests__/handsFreeSos.test.ts` — on / off / revoke / test window /
  location throttling, and that Settings shows exactly the phrases Siri hears.

## What only a real device and backend can check

Siri recognising the phrases; the intent running on a locked phone; the
Keychain shared between app and extension; location inside the extension; the
whole path against the deployed backend. Do them on the iPhone once Firebase is
live (`docs/plan/IMPLEMENTATION_PHASES.md`, Firebase test plan).
