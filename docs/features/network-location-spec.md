# Feature Spec: Network Location for Basic-Phone Family Members

> Save this file in your repo at `docs/features/network-location.md`.
> Replace everything in `[brackets]` with your real details before using it with Claude Code.

## 1. Summary
wayLoc already exists. We are adding a production feature that lets a guardian
(smartphone, using our app) see the approximate location of a family member who has a
basic (feature) phone with NO internet and NO app. Location comes from the mobile
operator's network via GSMA Open Gateway / CAMARA APIs, using the member's phone number.
The member can also send SOS and check-ins by missed call or SMS.

Markets: UK (+44) and India (+91).

## 2. Our existing stack
- Mobile app: [e.g. React Native / Flutter / native]
- Backend: [e.g. Node.js + TypeScript, NestJS/Express]
- Database: [e.g. PostgreSQL + Prisma/TypeORM]
- Auth: [e.g. Firebase Auth / JWT]
- Push: [e.g. FCM + APNs]
- Queue/jobs: [e.g. BullMQ + Redis / AWS SQS / none yet]
- Hosting: [e.g. AWS, region(s)]
- Location provider(s): [e.g. Vonage / Nokia Network as Code - or "not chosen yet"]
- SMS/voice providers: UK [e.g. Twilio], India [e.g. Exotel]

Follow existing conventions, folder structure, libraries, and patterns. Do not introduce
new frameworks unless necessary, and explain why if you do.

## 3. Key rule: consent is mandatory
No location lookup may ever happen without ACTIVE consent. Enforce this in the backend
service layer, not only in the UI. There is no bypass, including for admins.

## 4. Consent flow (two layers)

### Layer 1 - wayLoc SMS consent (always required)
1. Guardian adds a member by phone number (validate and store in E.164 format).
2. Guardian confirms in the app that they are the parent/legal guardian (store this as
   parental-consent evidence: user ID, timestamp, terms version, IP/device info).
3. Backend sends SMS to the member:
   "[Guardian name] wants to see your approximate location using wayLoc.
    Reply YES to allow or NO to refuse. Reply STOP anytime to stop."
4. Inbound SMS webhook processes the reply:
   - YES -> Layer 1 approved
   - NO -> declined
   - STOP (any time) -> revoked; immediately disable all lookups and geofences
   - Also accept Hindi equivalents (configurable keyword list)
5. Consent request expires if no reply within [48 hours] (configurable); allow resend
   with rate limits.

### Layer 2 - Operator consent (per operator, pluggable)
Different operators handle consent differently. Implement a ConsentStrategy interface
with these strategies, selected per operator via configuration:
- **CIBA**: backend calls the operator's `/bc-authorize` with `login_hint=tel:<number>`
  and the location scope + purpose; operator contacts the subscriber (SMS/USSD); backend
  polls `/token` (respecting the interval) or receives a callback; store tokens securely
  and handle refresh/expiry.
- **RECORDED_CONSENT**: operator accepts consent recorded by us (Layer 1); backend
  obtains tokens server-side.
- **ACCOUNT_HOLDER**: SIM account holder (e.g. guardian who pays the bill) approves.

Mark all operator-specific details as TODO where unconfirmed.

### Consent state machine
```
PENDING_SMS -> SMS_APPROVED -> OPERATOR_PENDING -> ACTIVE
Any state   -> DECLINED / EXPIRED / REVOKED
```
- Every transition is stored in a `consent_events` table (append-only audit trail).
- Only ACTIVE allows lookups.
- Operator revocation notices (if provided) must move state to REVOKED.

## 5. Location lookup ("Find")
- App calls OUR backend only:
  `POST /api/family/members/{memberId}/locate`
- Backend checks, in order:
  1. Caller is a guardian of this member
  2. Consent is ACTIVE
  3. Rate limit not exceeded (default max 1 lookup/minute/member, [N]/day)
  4. Then call the provider
- Provider call follows CAMARA Device Location Retrieval, for example:
  ```http
  POST /location-retrieval/v0/retrieve
  { "device": { "phoneNumber": "+447700900123" }, "maxAge": 60 }
  ```
  Response contains `lastLocationTime` and an `area` (CIRCLE: center + radius).
  Verify the exact path, version, and auth against the chosen provider's docs.
- Return to app: lat, lng, radius in metres, timestamp, provider, status.
- App shows a circle on the map labelled "Approximate network location" and
  "Last seen HH:MM".
- After a successful lookup, send the member a transparency SMS
  ("[Guardian] checked your approximate location via wayLoc. Reply STOP to stop.").
  Throttle to max one notice per [hour], but never disable it.
- Handle errors with clear user messages: consent missing, phone off/no signal,
  operator not supported, roaming, provider timeout, rate limited.

## 6. Safe zones (geofencing)
- Guardian creates circular zones (name, centre, radius, optional schedule).
- If the operator supports CAMARA Geofencing Subscriptions, create subscriptions and
  handle enter/leave callbacks (verify signatures, idempotent).
- Otherwise, fall back to scheduled CAMARA Location Verification checks
  (configurable interval, cost-aware, only while consent is ACTIVE).
- Push notifications: "[Member] reached School at 08:42" / "[Member] left Home".
- Deduplicate events and add hysteresis to avoid repeated alerts at zone edges.

## 7. SOS and check-ins (missed call / SMS)
- Virtual numbers per market receive inbound calls and SMS via webhooks.
- Missed call or SMS "HELP" from a linked member with ACTIVE consent:
  immediate location lookup (bypasses the normal per-minute rate limit, but still logged)
  -> high-priority push + SMS to all guardians with map link and time.
- If location lookup fails, still alert guardians immediately
  ("SOS received, location unavailable").
- Check-in keywords: HOME, SCHOOL, OK (configurable, include Hindi options)
  -> normal-priority push to guardians.
- Unknown numbers: ignore or rate-limit; never reveal member data.
- India: all outbound SMS must use TRAI DLT-registered sender IDs and template IDs
  (store in config per template).

## 8. Architecture requirements
- **LocationProvider** interface (`retrieve`, `verify`, `createGeofence`,
  `deleteGeofence`) with adapters for [chosen providers], plus a MockProvider for
  development and tests only.
- Provider routing per phone number by country and operator (configurable mapping).
- **MessagingProvider** interface (`sendSms`, `parseInboundSms`, `parseInboundCall`)
  with adapters per market + mock.
- **ConsentStrategy** interface as described in section 4.
- Background jobs for consent SMS, operator consent polling, geofence polling, and
  outbound alerts - with retries, exponential backoff, and idempotency keys.
- Verify all webhook signatures. All webhook handlers must be idempotent.
- Wrap the whole feature in a feature flag, enabled per market.
- Credentials only in our secrets manager / environment, never in code.
- Do NOT invent provider endpoints, fields, or SDK methods. Implement against official
  CAMARA specs and provider docs; mark uncertain parts with TODO and list the docs to check.

## 9. Data model (adapt to our existing schema style)
- `basic_phone_members` (id, family_id, phone_e164, country, operator, display_name)
- `consents` (id, member_id, guardian_id, state, strategy, terms_version, timestamps)
- `consent_events` (append-only: consent_id, from_state, to_state, source, raw_ref, timestamp)
- `operator_tokens` (encrypted; member_id, provider, expires_at)
- `location_lookups` (member_id, requested_by, reason [manual/sos/geofence], result,
  lat, lng, radius, provider, cost_units, timestamp)
- `safe_zones`, `geofence_subscriptions`, `geofence_events`
- `sos_events`, `checkin_events`
- Encrypt location fields at rest.

## 10. Privacy, security, abuse prevention
- Consent enforced server-side for every lookup path (manual, SOS, geofence).
- Full audit log of lookups and consent changes.
- Data retention job: delete raw location data after [30] days (configurable);
  SOS records kept per policy [e.g. 1 year].
- Data residency: store India users' data in [Indian region] if required.
- Tracked member can always reply STOP; guardian sees the status change immediately.
- Detect suspicious patterns (e.g. many members added by one account, very frequent
  lookups) and flag for review.
- Compliance notes for README: UK GDPR + ICO Children's Code, India DPDP Act 2023
  (verifiable parental consent), TRAI DLT for SMS.

## 11. App screens
1. Add basic-phone member (number, name, guardian confirmation)
2. Consent status (Waiting for reply / Approved / Waiting for operator / Active /
   Declined / Revoked) with resend option
3. Member map: Find button, circle, last seen, error states
4. Safe zones: create/edit/delete on map
5. SOS alert screen (full-screen, high priority) with map and call button
6. Event history timeline

## 12. Quality
- Unit tests: consent state machine, keyword parsing (English + Hindi), rate limits,
  provider routing, guardian authorisation checks.
- Integration tests with mock providers: full consent flow, Find, geofence event,
  SOS end-to-end, STOP revocation.
- Structured logs + metrics: lookup success rate, latency, cost per lookup, SOS alert
  delivery time, consent conversion rate.
- Migrations using our existing migration tool.
- Runbook: provider outage, SMS delivery failure, operator revoking access.
