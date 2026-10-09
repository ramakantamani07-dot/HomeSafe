# Operating wayLoc

What to watch, what to do when something breaks, and how to measure battery
on a real walk. Written before launch (Phase 8), so every step here is a
plan until it has been done once against the real project — update it the
first time each runbook is used.

## What to watch

Cloud Functions write structured log lines with `jsonPayload.metric`
(`functions/src/shared/metrics.ts`). Create a log-based metric for each in
Cloud Logging → Logs-based metrics, filtered on `jsonPayload.metric="<name>"`.

| Metric | Fields | Alert when |
|---|---|---|
| `member_sos` | `source`, `guardians`, `reached`, `deliveryMs` | **any** entry with `reached` < `guardians`; p95 `deliveryMs` > 10 s |
| `locate` | `outcome`, `reason`, `latencyMs`, `failure`, `billedUnits` | `provider-error` share > 20% over 15 min; p95 `latencyMs` > 8 s |
| `zone_check` | `outcome`, `latencyMs`, `event`, `billedUnits` | `provider-error` share > 20% over an hour |
| `consent_transition` | `from`, `to`, `trigger` | conversion (`→ ACTIVE` ÷ `→ PENDING_SMS`) drops sharply week on week |
| `ask_ok` | `delivered` | `delivered: false` share > 50% (push tokens going stale) |
| `push_failed` | `kind`, `code` | any `kind: MEMBER_SOS` |

**Cost per lookup** = sum of `billedUnits` × the aggregator's unit price, per
day. Zone checks are the steady cost (one unit per zone per 15 minutes while
consent is ACTIVE); Find and SOS are bursts.

No metric carries a phone number, a name or a coordinate. Keep it that way.

## Runbooks

### Operator or aggregator outage

*Signs:* `locate` and `zone_check` `provider-error` spike; guardians report
"Couldn't ask the network".

1. Confirm on the aggregator's status page; note the start time.
2. **SOS still alerts** without a location (D28) — check `member_sos`
   `reached` = `guardians`. If SOS alerts are failing, that is the incident;
   everything else waits.
3. Zone checks keep failing quietly and recover by themselves; no action.
4. If the outage will last hours, consider pausing zone checks to stop
   spending invocations: remove the market from `NETWORK_LOCATION_MARKETS`.
   *This also stops new consent texts and Find* — tell guardians in-app first.
5. Afterwards: record duration and affected lookups from the `locate`
   metric.

### SMS provider failure

*Signs:* logs `Member SMS not sent` / `Consent request SMS failed`;
consent requests stuck at `requestSms.status = failed`; members not
receiving transparency texts.

1. Check the provider's status page and our account balance.
2. **Inbound STOP still works** if inbound webhooks arrive — verify one
   `consent_transition` with `trigger: member-revoked` since the failure began.
   If inbound is also down, members cannot stop by text: post a notice and
   remind guardians that "Stop finding" in the app works offline.
3. Transparency texts that failed are retried on the next lookup by design
   (the throttle is released on failure, D21) — no backfill needed.
4. Consent requests that failed show "We couldn't text them" to the guardian
   and can be resent once the provider recovers (Resend, D26).
5. India: confirm DLT templates are still registered — an unregistered
   template is silently dropped by carriers, which looks exactly like this.

### An operator revokes our access

*Signs:* `locate` failures with `operator-unsupported` for one operator;
consent strategy calls rejected.

1. Identify the operator from the aggregator dashboard (we do not log
   numbers).
2. Members on that operator cannot be found. Their consent stays as it is —
   do **not** revoke on their behalf: they did not ask to stop.
3. Guardians see "Their network can't do this yet". If access will not
   return, send members on that operator a text saying finding has stopped
   and why.
4. Record the revocation and the date; it is evidence for the legal review.

### Push notifications not arriving

*Signs:* `push_failed` entries; `ask_ok` `delivered: false` rising.

1. `messaging/registration-token-not-registered` is pruned automatically and
   is normal at a low rate.
2. `messaging/third-party-auth-error` means the APNs key in Firebase is
   missing or expired — renew it in the Apple Developer account and upload
   it to Firebase → Cloud Messaging.
3. SOS from a basic phone also sends an SMS to the guardian, so a push outage
   degrades rather than silences it — confirm SMS is healthy.

### A member says they were found after texting STOP

Treat as a serious incident.

1. Find their consent documents (Firestore console, `consents` collection
   group, filtered on `phoneNumber`).
2. Read `consentEvents` for the STOP (`trigger: member-revoked`) and its time.
3. Read `locateAudits` around that time: a `success` after the STOP would be
   a defect — `locate` re-checks consent after the operator answers (D21).
4. Check `smsInbound` for the STOP's message id: if it is absent, the webhook
   never received it (provider problem); if present, it was processed.
5. Write up what happened and tell the member, whatever the cause.

## Battery test (needs a real walk)

The one Phase 8 item that cannot be done at a desk. Do it on the release
build, not the debug build — the dev client keeps extra work running.

1. Charge to 100%. Close other apps. Note the start time and battery.
2. Start a journey to a place 20–30 minutes' walk away, check-ins every 10
   minutes, phone in a pocket.
3. Answer one check-in from the lock screen; leave one unanswered until the
   safety check appears, then answer it.
4. On arrival, note battery and time. In Settings → Battery, note wayLoc's
   share and its screen-on vs background minutes.
5. Repeat with Low Power Mode on.

**Pass:** under ~5% battery per 30-minute walk at normal tier, location
updates stopping within a minute of arrival (no wayLoc background activity
afterwards), and no wake-ups while the app is not on a journey. Record the
results in `docs/plan/IMPLEMENTATION_PHASES.md`.
