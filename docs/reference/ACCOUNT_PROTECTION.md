# Account protection

**Status (10 Oct 2026):** the app and server parts are built and tested
against mocks and the emulator. Two console settings are yours to switch on.
Nothing here has run on a deployed Firebase project yet.

## The threat

wayLoc signs people in with their phone number and a texted code. That is
the right sign-in for families, but it means **whoever controls the number
controls the account**:

- **SIM swap** — someone talks the mobile network into moving your number
  to their SIM. Your phone loses signal; theirs gets your sign-in code.
- **A borrowed or stolen phone** — someone with your unlocked phone for a
  minute can add themselves as a person who sees your location.
- **SMS cost abuse** — scripts request thousands of sign-in texts to premium
  numbers, and the project pays for each.

In most apps a taken-over account is an inconvenience. In wayLoc it hands
someone your live location and your family's. That is why the protections
below exist, and why they stop short of anything that could delay help.

## One rule above the rest

**Nothing that gets someone help, or reduces what others can see, is ever
gated.** SOS, I'm OK, stopping sharing, removing a watcher, a STOP text: none
of these ask for Face ID, whatever the settings. A safety action that waits
on a face scan has failed, and anything that narrows exposure is something an
attacker would not want done.

## What is built

### 1 · Confirm it's you before sensitive changes

The phone asks for Face ID, Touch ID or its passcode before any change that
widens who can find you, or who is told when you need help:

| Action | Where it is checked |
|---|---|
| Invite someone to your family | `useFamily` |
| Accept a family invitation | `useFamily` / `useLiveFamily` |
| Add a basic-phone member to find | `useBasicPhoneMembers` |
| Add a safe zone for them | `useBasicPhoneMembers` |
| Add, change or remove a trusted contact | `useContacts` |
| Delete the account, resolve an SOS | already gated (`useAccountDeletion`, `useSOS`) |

- The check lives in the **hooks**, not the screens, so every screen that
  reaches the action is covered, including ones added later.
- Cancelling the prompt does nothing and shows no error
  (`IdentityNotConfirmedError`).
- On a phone with no Face ID or Touch ID set up the change goes ahead, as
  account deletion and SOS resolve already do: there is nothing to check
  against, and blocking would only punish the owner.
- Code: `src/models/AccountProtection.ts`, `src/hooks/useIdentityGuard.ts`,
  `PrivacyContext.confirmIdentity`.

### 2 · App lock offered at sign-in

"You're in" now offers **Lock wayLoc with Face ID or Touch ID**, ticked by
default where the phone has one. It was already in Privacy & Security, off by
default, where few people would find it. A stolen unlocked phone otherwise
opens straight onto everyone's locations. Not on the AN3 board; recorded here
as the reason.

### 3 · Warning when the account signs in on a new phone

- Each installation records itself once, under
  `users/{uid}/devices/{installationId}` (`DeviceRegistryProvider`). The id
  is random and kept in the phone's secure storage.
- The first time a new id appears, `onDeviceRegistered` (Cloud Function):
  - pushes to the account's **other phones**: "New sign-in to your wayLoc — at
    10:42 on an iPhone wayLoc hadn't seen before. If that wasn't you, call your
    mobile network now: someone may have moved your number to a new SIM.";
  - pushes to **everyone in the family**: "Priya's wayLoc was signed in on a
    new phone — at 10:42. If Priya hasn't changed phones, check with them
    another way before sharing more."
- The account's first phone sets off nothing.
- **The app can create and refresh its record, but never read or delete
  one** (`firestore.rules`). Otherwise someone holding the account could reuse
  the old phone's id, or delete its record, and sign in unannounced.
- Sent once per new phone even if the trigger repeats (claimed with
  `alertedAt`, server-only). Times are in the account's local time zone.
- Reinstalling on the same iPhone is not a new phone (the keychain keeps the
  id). On Android a reinstall is, which is why the wording says "a phone
  wayLoc hadn't seen before" rather than accusing anyone.
- Deleted with the account (`onUserAccountDeleted`). Metric: `new_device`.

### 4 · Monthly "who can see you" reminder

A local notification every 30 days: "Who can see your location? Take a moment
to check your family in wayLoc." Tapping it opens Family. It is scheduled once
and left alone (re-scheduling on each launch would restart its clock), and it
is cancelled on sign-out.

### Already in place before this

Database rules limit every record to its owner; only the server can make a
basic-phone consent active; rate limits on the invitee lookup (20 a day),
Ask "OK?" (one per 5 minutes), test alerts (hourly) and Find (hourly);
signed SMS/voice webhooks; App Check on the server functions
(`APP_CHECK.md`); five wrong sign-in codes lock a number for 10 minutes; a
duress PIN; a jailbroken-phone warning; a pre-commit hook that blocks
secrets.

## What you need to do — Firebase console

1. **Authentication → Settings → SMS region policy → Allow only United Kingdom
   and India.** Sign-in texts to any other country are refused, which stops
   most SMS cost abuse. About two minutes.
2. **App Check → Authentication → enable** once the app sends App Check
   tokens (`APP_CHECK.md`, step 2). Scripts then cannot ask for sign-in codes
   at all.

## Not done, and why

| Idea | Why not now |
|---|---|
| A second sign-in factor (authenticator app) | Firebase supports it only on the paid Identity Platform upgrade, and it adds friction for families. Worth offering as an option later, never as a requirement. |
| A device list with "sign out other phones" | Signing the other phone out does not help against a SIM swap: whoever holds the number signs straight back in. Useful later for a lost phone; needs a screen and a server call to revoke sessions. |
| SIM-swap check at sign-in | The CAMARA **SIM Swap** API answers "did this number change SIM in the last N hours?" — exactly the attack above. It comes from the same operator aggregator as basic-phone finding, so it waits on decision G3. When it lands: check at sign-in, and on a recent swap hold sensitive changes for 24 hours and warn the family. |
| Certificate pinning | See `SECURITY_REVIEW.md`: a pinning mistake cuts every user off until an app update ships. |

## Tests

- `functions/src/__tests__/newDevice.test.ts` — who is warned: never the new
  phone itself, never for the first phone, only active family.
- `src/__tests__/firestoreRules.test.ts` — device records: owner can register
  and refresh, nobody can read or delete one, the app cannot set the server's
  claim or change the platform, nobody writes for someone else.
