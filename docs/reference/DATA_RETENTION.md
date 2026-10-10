# wayLoc Data Retention Policy

Last updated: 2026-09-01

---

## Data categories and retention periods

| Category | Where stored | Retention | Deletion trigger |
|---|---|---|---|
| User profile (name, phone) | Device SecureStore | Until account deleted | Account deletion |
| App preferences (biometric, settings) | Device SecureStore | Until account deleted | Account deletion |
| FCM device token | Firestore `users/{uid}` | Until sign-out or account deleted | `removeDeviceToken` on sign-out; account deletion |
| Trusted contacts | Firestore `users/{uid}/contacts` | Until user removes them or account deleted | Manual removal; account deletion |
| Journey summaries (destination, dates, status) | Firestore `users/{uid}/journeys` | Until user deletes account | Account deletion (or future "delete journey" action) |
| GPS location trail (locationUpdates) | Firestore `users/{uid}/journeys/{id}/locationUpdates` | 30 days for completed; 7 days for cancelled/missed; **indefinite for SOS_TRIGGERED — a deliberate decision, see below** | Manual "Delete Location Trails"; account deletion; scheduled `enforceDataRetention` Cloud Function |
| Check-in records | Firestore `users/{uid}/journeys/{id}/checkIns` | Until account deleted | Account deletion |
| SOS event records | Firestore `users/{uid}/sosEvents` | 90 days after resolution (unresolved records are never auto-deleted) | Account deletion; scheduled `enforceDataRetention` Cloud Function |
| Offline operation queue | Device AsyncStorage | 7 days for failed items; cleared on account deletion | `DataRetentionService.cleanupExpiredLocalData()`; account deletion |
| Fake call settings | Device AsyncStorage | Until app uninstalled or account deleted | Account deletion clears AsyncStorage entries |
| Consent records + consent events (network location) | Firestore `users/{uid}/consents`, `consentEvents` | Kept as evidence; never client-deletable. Revoked (not deleted) when the guardian's account is deleted | Retention period **not yet defined** — needs the Phase 6 legal review (G3) |
| Basic-phone members | Firestore `users/{uid}/basicPhoneMembers` | Until the guardian removes them or deletes their account | Manual removal; `onUserAccountDeleted` |
| Locate audits, incl. operator-reported location | Firestore `users/{uid}/locateAudits` | Location: 30 days. The audit record itself: kept | `enforceDataRetention` clears `location` / `accuracyMeters` |
| Inbound SMS de-duplication marks (message-id hash only, no number or text) | Firestore `smsInbound` | 7 days | `expireAt` field — needs a Firestore TTL policy configured on the collection |

---

## Retention constants (`src/models/DataRetentionPolicy.ts`)

```typescript
DATA_RETENTION_DAYS = {
  completedJourneyLocationHistory: 30,   // GPS trail for completed journeys
  cancelledJourneyLocationHistory: 7,    // GPS trail for cancelled / missed journeys
  sosRecords: 90,                        // SOS event records (safety audit trail)
  failedOfflineQueueItems: 7,            // Failed offline-queue items
  networkLocationFixes: 30,              // Operator location on locate audits
}
```

---

## Client-side cleanup (currently implemented)

### DataRetentionService.cleanupExpiredLocalData()

Runs on-demand (e.g. app launch). Removes:
- Failed offline-queue items older than `failedOfflineQueueItemsDays` (default 7 days).

Call site: add to `AppProviders` startup or `app/_layout.tsx` on app focus.

### JourneyService.deleteJourneyHistory(userId)

User-triggered from the Privacy & Data screen. Removes:
- All `locationUpdates` documents for each completed/cancelled/missed/SOS journey.
- Clears `currentLocation` and `lastLocationAt` from the journey summary document.

The journey summary documents themselves are kept so the user retains a history of
where they travelled and when.

### AccountDeletionService.deleteAccount(userId)

User-triggered from the Delete Account screen. Removes:
- All journey sub-collections and documents.
- All contacts and SOS events.
- Root user Firestore document.
- Offline queue.
- Local SecureStore user profile.
- Firebase Auth account.

---

## Server-side cleanup

### Scheduled Cloud Function — implemented

`functions/src/index.ts` exports `enforceDataRetention`, an `onSchedule('every 24 hours', ...)`
function that runs independent of whether any client ever opens the app:

1. Queries the `journeys` collection group where `status == 'COMPLETED'` and
   `endedAt <= now - 30 days`, and purges each match's `locationUpdates` sub-collection.
2. Queries the same collection group where `status in ['CANCELLED', 'MISSED_CHECKIN']` and
   `endedAt <= now - 7 days`, and does the same.
3. Queries the `sosEvents` collection group where `status == 'RESOLVED'` and
   `resolvedAt <= now - 90 days`, and deletes those records outright. An `ACTIVE` (unresolved)
   SOS record is never touched regardless of age.
4. Logs counts via `firebase-functions/logger` for audit purposes.

Requires the composite indexes in `firestore.indexes.json` (deploy with
`firebase deploy --only firestore:indexes`) — Firestore rejects a collection-group query with a
range filter unless the matching index exists.

**Decision: `SOS_TRIGGERED` journeys are retained indefinitely, not silently 7 or 30 days.**
`JourneyProvider` leaves `endedAt` null on that transition, because an SOS being triggered doesn't
mean the journey itself has ended — there is no defined point in time to measure a 7/30-day window
from. Rather than inventing one, the decision is to not purge this category at all, for the same
reason unresolved SOS event records are already never auto-deleted: this is exactly the data an
actual emergency touched, and it's needed for exactly as long as anyone might need to reconstruct
what happened. Two paths lead to `SOS_TRIGGERED`: a normal resolve moves the journey to `COMPLETED`
with `endedAt` set, so ordinary 30-day retention picks it up from there — the indefinite case is
specifically a journey nobody ever resolved, or one resolved with the duress code (see
`IMPLEMENTATION_PLAN.md`'s duress/silent-SOS item), which by design leaves status untouched so the
location trail survives as a record of what actually happened rather than what the resolve looked
like on screen.

Firestore's native TTL policies were considered instead of a Cloud Function, but don't fit: TTL
deletes a whole document once a single timestamp field crosses a threshold, with no way to
express "30 days if COMPLETED, 7 days if CANCELLED" or "only if RESOLVED" — both of which this
policy requires.

### Account-deletion Cloud Function — still not implemented

Triggered on `auth.user().onDelete()` Firebase event. Should:
1. List all Firestore documents for the deleted uid.
2. Delete them recursively using the Admin SDK.
3. Log the deletion for compliance records.

This catches any Firestore data not removed by the client-side `AccountDeletionService`
(e.g. if the client failed mid-deletion before the auth account was removed). Tracked as a 🟡
item in `IMPLEMENTATION_PLAN.md` Phase 1 — not done in this pass.

---

## User controls summary

| Action | Where | What it removes |
|---|---|---|
| Delete location trails | Privacy & Data screen | GPS locationUpdates for all finished journeys |
| Delete account | Privacy & Data → Delete Account | Everything (see account deletion sequence in SECURITY_REVIEW.md) |
| Remove contact | Contacts screen | Single contact document |
| Sign out | Profile screen | Local auth session; device token removed from Firestore |

---

## Proposed, not built (10 Oct 2026): keep less on the server

Some people would rather their data stayed on their phone. This section
records which data can, which cannot, and two changes to make later. Nothing
here is implemented yet; the tables above describe what the app does today.

### The test

**Does someone else need it at a moment when your phone can't help?** A
phone that is dead, smashed, taken or out of signal cannot raise an alert.
The server can — but only if it already holds what it needs.

### Must stay on the server

| Data | Why it cannot be phone-only |
|---|---|
| Active journey and its live location, while the journey runs | Family watch it live; if the phone dies mid-walk, the server's missed-check-in backstop alerts them with the last known position |
| Trusted contacts | The server sends SOS and missed-check-in alerts (push or text) even when the phone is off |
| SOS records | Once SOS is held, the alert must go out even if the phone is taken a second later; the record is also evidence |
| Family connections and shared status | Other people's phones read them |
| Basic-phone consents and locate audits | Proof the person agreed to be found; only the server may make consent ACTIVE |
| Account and device list | Sign-in, and the new-phone warning (`ACCOUNT_PROTECTION.md`) |

### Could be phone-only — only the owner ever uses it

| Data | Today | What moving it costs |
|---|---|---|
| Journey history after arrival (destination, times) | Firestore, until the account is deleted | Lost with the phone; not in the data export |
| Location trail after arrival | Firestore, 30 days (7 for cancelled or missed) | Route no longer shown in history; guardians can't look back |
| Saved places (Home, Work, School) | Firestore | Re-added on a new phone. Among the most sensitive things held |
| Walk feedback | Firestore, private | Nothing material |
| "Feeling uneasy" log | Firestore | The route-safety insight it was kept for |
| Check-in records after a journey | Firestore, until the account is deleted | Nothing for safety |

Already phone-only: profile copy, settings and app lock, duress PIN, fake-call
settings, offline queue.

### What the location trail is

The GPS points the phone sends **only during a journey**: position, accuracy,
heading, speed and time (`LocationUpdate`), stored under the journey in
`locationUpdates`. One point every 30 s or 50 m on a normal journey; every
15 s or 25 m after "Feeling uneasy?"; every 10 s or 20 m during SOS; every
60 s or 100 m on low battery (`TrackingConfig`). A 20-minute walk leaves about
40 points — joined up, the exact route, street by street.

During the journey it powers Watch live, the last known position on a missed
check-in, and the guardians' view in an SOS. **After arrival it serves no
safety purpose.**

### Proposal 1 — delete the trail when the journey ends

Delete `locationUpdates` from the server as soon as a journey is ARRIVED or
CANCELLED, instead of after 30 / 7 days. **Unchanged:** SOS journeys keep
their trail (decision above), and so do journeys with a missed check-in or an
escalated safety check, until that is resolved.

- **Gain:** 30 days of exact routes — where someone walks, when, and which
  way home — stops existing on the server. Much less exposed in a breach or
  to a legal demand. The biggest privacy gain available, at no safety cost.
- **Cost:** journey history no longer draws the route walked; a guardian
  cannot look back at yesterday's walk.
- **Shape:** a Firestore trigger on the journey reaching ARRIVED / CANCELLED
  that deletes its `locationUpdates` in batches; `enforceDataRetention` stays
  as the backstop. Update the table at the top of this file.

### Proposal 2 — "Keep my history on this phone only", on by default

Journey history, saved places, walk feedback and the uneasy log are stored on
the phone (secure storage / local database) instead of Firestore. The setting
says plainly: *if you lose or change your phone, this history goes with it.*

- **Gain:** the owner's routine (home and school addresses, where they go)
  never leaves the phone.
- **Cost:** no history on a new phone, none in the data export, and the
  uneasy-log insight is lost.
- **Shape:** phone-backed adapters behind the existing ports
  (`SavedPlaceProvider`, `WalkFeedbackProvider`, `UneasyEventProvider`, the
  history half of `JourneyProvider`), chosen by the setting — no screen
  changes.

### Not proposed

Moving anything from "Must stay on the server" to the phone. It would make the
app look as safe while being unable to help when the phone is not there —
the kind of claim Option 15 §1 principle 4 forbids.

### To decide

- [ ] Proposal 1: delete the trail on arrival (recommended)
- [ ] Proposal 2: phone-only history setting, and whether it is on by default
