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
